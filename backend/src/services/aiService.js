const axios = require('axios');
const Listing = require('../models/Listing');
const Share = require('../models/Share');

const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL_ORDER = process.env.GEMINI_MODEL_ORDER
  ? String(process.env.GEMINI_MODEL_ORDER).split(',').map((s) => s.trim()).filter(Boolean)
  : [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash-lite']
    .filter(Boolean)
    .filter((model, index, arr) => arr.indexOf(model) === index);

const normalizeGeminiReason = (raw = '') => {
  const msg = String(raw || '').toLowerCase();
  if (!msg) return 'gemini_error';
  if (msg.includes('api key not valid') || msg.includes('permission denied') || msg.includes('unauthenticated')) {
    return 'invalid_api_key';
  }
  if (msg.includes('not found for api version') || msg.includes('model') && msg.includes('not found')) {
    return 'model_unavailable';
  }
  if (msg.includes('quota')) return 'quota_exceeded';
  if (msg.includes('timeout')) return 'timeout';
  return 'gemini_error';
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'from', 'near', 'show', 'find', 'search', 'need',
  'want', 'please', 'help', 'how', 'what', 'is', 'are', 'to', 'in', 'on', 'at', 'of', 'me', 'my',
  'under', 'below', 'above', 'over', 'rent', 'buy', 'sale', 'item', 'items', 'listing', 'listings',
  'product', 'products', 'thing', 'things', 'stuff', 'any', 'available', 'yes', 'no', 'ok', 'okay',
  'platform', 'app', 'application', 'uniconnect',
]);

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LISTING_CATEGORIES = new Set(['physical', 'digital', 'ticket', 'merch']);

const PLATFORM_GUIDE = [
  'UniConnect navigation and exact labels:',
  '- Home (/): overview with live listings, active shares, nearby listings/shares, and Set Location.',
  '- Marketplace (/marketplace): browse/search all listings and filter by category or listing type.',
  '- My Listings (/my-listings): manage your product listings and buy requests. To list an item, open My Listings and click + Create. There is no Sell button.',
  '- Create Listing (/listings/new): create a product listing with title, description, price, category, listing type, tags, location, and image.',
  '- Rental (/rentals): manage rental listings and rental requests. Use + Create or /rentals/new for rental items.',
  '- Sharing (/shares): create cab, food, or other sharing groups; split expenses; request to join; approve/reject members; finalize shares. To list/create a share, open Sharing, go to My Sharing, click + Create, choose Type of Sharing, enter total amount and split type, then submit Create Share.',
  '- Chat (/chat): message sellers, buyers, and share group members after opening/creating a chat.',
  '- Notifications (/notifications): see bid, offer, chat, rental, sharing, moderation, and admin updates.',
  '- Profile (/profile): edit name/password and set precise location.',
  '- Listing details (/listings/:id): view images, price, description, location, report a listing, buy now, make offer, request rental, or bid in auctions.',
  '- Admin (/admin): admins review flagged listings, users, analytics, and rental disputes.',
].join('\n');

const tokenizeQuery = (message = '') => {
  return String(message)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
};

const hasPriceConstraint = (message = '') => /(?:under|below|less than|above|over|more than)\s*[₹rs\s]*[0-9]+/i.test(String(message));

const isPriceOnlyListingQuery = (message = '') => {
  if (!hasPriceConstraint(message)) return false;
  return sanitizeSearchTerms(tokenizeQuery(message)).length === 0;
};

const inferListingContextFromHistory = (history = []) => {
  if (!Array.isArray(history)) return null;

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (turn?.role !== 'user') continue;
    const tokens = tokenizeQuery(turn.content || '');
    const candidate = tokens.find((token) => !['cheap', 'budget', 'price'].includes(token));
    if (candidate) return candidate;
  }

  return null;
};

const extractSearchHints = (message = '') => {
  const text = String(message).toLowerCase();
  const tokens = tokenizeQuery(text);

  const priceUnder = text.match(/(?:under|below|less than)\s*[₹rs\s]*([0-9]+)/i);
  const priceAbove = text.match(/(?:above|over|more than)\s*[₹rs\s]*([0-9]+)/i);

  // Only accept the platform's real listing categories here. Product names
  // like "painting" should stay search terms, not broaden into "physical".
  return {
    priceMax: priceUnder ? Number(priceUnder[1]) : null,
    priceMin: priceAbove ? Number(priceAbove[1]) : null,
    category: tokens.find((token) => LISTING_CATEGORIES.has(token)) || null,
    tokens,
    keyword: text,
  };
};

const extractShareHints = (message = '') => {
  const text = String(message).toLowerCase();
  let shareType = null;

  if (/\bfood|meal|snack|order\b/.test(text)) shareType = 'food';
  else if (/\bcab|ride|trip|travel\b/.test(text)) shareType = 'cab';
  else if (/\bproduct|bulk|group buy\b/.test(text)) shareType = 'product';

  const maxAmountMatch = text.match(/(?:under|below|less than)\s*[₹rs\s]*([0-9]+)/i);

  return {
    shareType,
    priceMax: maxAmountMatch ? Number(maxAmountMatch[1]) : null,
  };
};

const isShareGuidanceQuery = (message = '') => {
  const text = String(message || '').toLowerCase();
  const asksHowOrWhere = /\b(how|where|what|can|do|does|guide|steps?)\b/.test(text);
  const shareTopic = /\b(share|sharing|split|expense|expenses|bill|bills)\b/.test(text);
  const createOrManageAction = /\b(create|list|post|add|make|start|open|use|manage|join|request|approve|reject|finalize|complete)\b/.test(text);
  const clearDiscoverySignal = /\b(find|show|search|available|near|under|below|above|less than|more than|cheap|budget)\b/.test(text);

  return shareTopic && (asksHowOrWhere || createOrManageAction) && !clearDiscoverySignal;
};

const getListingText = (item = {}) => [
  item.title,
  item.description,
  item.category,
  item.condition,
  ...(Array.isArray(item.tags) ? item.tags : []),
].filter(Boolean).join(' ').toLowerCase();

const normalizeSearchTerm = (term = '') => {
  const normalized = String(term || '').toLowerCase().trim();
  if (normalized.length > 3 && normalized.endsWith('s')) return normalized.slice(0, -1);
  return normalized;
};

const scoreListing = (item, terms = []) => {
  if (!terms.length) return 1;

  const title = String(item.title || '').toLowerCase();
  const description = String(item.description || '').toLowerCase();
  const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : '';
  const category = String(item.category || '').toLowerCase();

  let score = 0;
  for (const term of terms) {
    const normalized = normalizeSearchTerm(term);
    if (!normalized) continue;
    if (title === normalized) score += 10;
    else if (title.includes(normalized)) score += 6;
    if (tags.includes(normalized)) score += 4;
    if (description.includes(normalized)) score += 2;
    if (category === normalized) score += 1;
  }

  return score;
};

const buildSearchTerms = ({ hints, route, history, message }) => {
  const routeTerms = Array.isArray(route?.searchTerms)
    ? route.searchTerms
    : tokenizeQuery(route?.searchQuery || '');
  const baseTerms = routeTerms.length ? routeTerms : hints.tokens;
  const terms = baseTerms
    .map(normalizeSearchTerm)
    .filter((term) => term.length >= 3 && !/^\d+$/.test(term) && !STOP_WORDS.has(term) && !LISTING_CATEGORIES.has(term));

  if (!terms.length && !hints.category && hasPriceConstraint(message)) {
    const contextualToken = inferListingContextFromHistory(history);
    if (contextualToken) terms.push(contextualToken);
  }

  return [...new Set(terms)];
};

const getRelevantListings = async (message, intent, history = [], route = {}) => {
  // For non-listing intents, avoid returning random latest listings cards.
  if (intent !== 'listing_discovery') return [];

  const hints = extractSearchHints(message);
  if (route.priceMin != null) hints.priceMin = route.priceMin;
  if (route.priceMax != null) hints.priceMax = route.priceMax;
  const searchTerms = buildSearchTerms({ hints, route, history, message });
  const query = {
    status: { $nin: ['archived', 'sold', 'blocked'] },
  };

  if (hints.category) query.category = hints.category;

  if (searchTerms.length) {
    query.$and = searchTerms.slice(0, 4).map((term) => {
      const regex = { $regex: escapeRegex(term), $options: 'i' };
      return {
        $or: [
          { title: regex },
          { description: regex },
          { tags: regex },
        ],
      };
    });
  }

  if (hints.priceMin || hints.priceMax) {
    query.price = {};
    if (hints.priceMin) query.price.$gte = hints.priceMin;
    if (hints.priceMax) query.price.$lte = hints.priceMax;
  }

  if (!searchTerms.length && !hints.category && !hints.priceMin && !hints.priceMax) {
    // Query has no meaningful search signal; avoid unrelated recommendation spam.
    return [];
  }

  const listings = await Listing.find(query)
    .select('title description price category condition listingType tags images createdAt')
    .sort(hints.priceMax && !searchTerms.length ? { price: 1, createdAt: -1 } : { createdAt: -1 })
    .limit(12)
    .lean();

  const filtered = searchTerms.length
    ? listings
      .map((item) => ({ item, score: scoreListing(item, searchTerms) }))
      .filter(({ item, score }) => score > 0 && searchTerms.every((term) => getListingText(item).includes(term)))
      .sort((a, b) => b.score - a.score || Number(a.item.price || 0) - Number(b.item.price || 0))
      .map(({ item }) => item)
    : listings;

  return filtered.slice(0, 3).map((item) => ({
    id: item._id,
    title: item.title,
    price: item.price,
    category: item.category,
    condition: item.condition,
    listingType: item.listingType,
    image: item.images?.[0]?.url || null,
  }));
};

const getRelevantShares = async (message, user, intent) => {
  if (intent !== 'sharing') return [];

  const hints = extractShareHints(message);
  const query = {
    status: 'open',
    collegeDomain: user?.collegeDomain,
  };

  if (hints.shareType) {
    query.shareType = hints.shareType;
  }

  if (hints.priceMax) {
    query.totalAmount = { $lte: hints.priceMax };
  }

  const shares = await Share.find(query)
    .select('name shareType totalAmount fromCity toCity foodItems productName deadlineTime bookingDeadline otherDeadline maxPersons maxPassengers members createdAt')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const now = new Date();

  const activeShares = shares.filter((share) => {
    if (share.shareType === 'cab' && share.bookingDeadline && new Date(share.bookingDeadline) < now) return false;
    if (share.shareType === 'food' && share.deadlineTime && new Date(share.deadlineTime) < now) return false;
    if (share.shareType === 'other' && share.otherDeadline && new Date(share.otherDeadline) < now) return false;
    return true;
  });

  return activeShares.map((share) => ({
    id: share._id,
    name: share.name,
    shareType: share.shareType,
    totalAmount: share.totalAmount,
    route: share.shareType === 'cab' ? `${share.fromCity || 'N/A'} -> ${share.toCity || 'N/A'}` : null,
    foodItems: share.shareType === 'food' ? share.foodItems || null : null,
    productName: share.shareType === 'product' ? share.productName || null : null,
    members: Array.isArray(share.members) ? share.members.filter((m) => m.status === 'joined').length : 0,
    capacity: share.maxPassengers || share.maxPersons || null,
  }));
};

const buildSystemPrompt = ({ user, intent }) => {
  const collegeDomain = user?.collegeDomain || 'unknown campus';
  const taskInstruction = intent === 'listing_discovery'
    ? 'The user is searching listings. Use only supplied matched listings. Do not mention products that are not supplied.'
    : intent === 'sharing'
      ? 'The user is searching sharing options. Use only supplied matched shares. Do not invent routes, prices, or members.'
      : intent === 'support_help'
        ? 'The user needs support or safety guidance. Explain the exact report, notification, admin review, or dispute path from the guide.'
        : 'The user is asking how the platform works. Answer from the UniConnect navigation guide.';

  return [
    'You are UniConnect Assistant for a student marketplace app.',
    taskInstruction,
    'Never claim to perform transactions. Guide the user to the exact page or button.',
    'Do not say there is a "Sell" button. Listing an item is done from My Listings > + Create or Create Listing.',
    'Keep answers short, practical, and free of markdown formatting.',
    `User campus context: ${collegeDomain}`,
    PLATFORM_GUIDE,
  ].join('\n');
};

const buildUserPrompt = ({ message, listings, shares, intent }) => {
  const listingsSummary = listings.length
    ? `Matched listings (max 3):\n${listings
      .map((item, index) => `${index + 1}. id=${item.id} | ${item.title} | INR ${item.price} | ${item.category} | ${item.listingType || 'buy-now'}`)
      .join('\n')}`
    : 'Matched listings: none';

  const sharesSummary = shares.length
    ? `Matched shares (max 3):\n${shares
      .map((item, index) => `${index + 1}. ${item.name} | ${item.shareType} | INR ${item.totalAmount}`)
      .join('\n')}`
    : 'Matched shares: none';

  if (intent === 'listing_discovery') {
    return [
      listingsSummary,
      'If matched listings are none, say no matching listings were found and ask for a more specific item or budget.',
      `User query: ${message}`,
    ].join('\n');
  }

  if (intent === 'sharing') {
    return [
      sharesSummary,
      'If matched shares are none, say no matching sharing options were found and suggest checking Sharing.',
      `User query: ${message}`,
    ].join('\n');
  }

  return [
    'Answer from the UniConnect navigation guide only.',
    `User query: ${message}`,
  ].join('\n');
};

const callGemini = async ({ prompt, history, systemPrompt }) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { text: null, reason: 'missing_api_key', model: null };
  }

  const contents = [];

  if (Array.isArray(history)) {
    history.slice(-8).forEach((turn) => {
      if (!turn?.content) return;
      const role = turn.role === 'assistant' ? 'model' : 'user';
      contents.push({ role, parts: [{ text: String(turn.content) }] });
    });
  }

  contents.push({ role: 'user', parts: [{ text: prompt }] });

  let lastReason = 'gemini_error';

  for (const modelName of GEMINI_MODEL_ORDER) {
    try {
      const { data } = await axios.post(
        `${GEMINI_BASE_URL}/models/${modelName}:generateContent?key=${apiKey}`,
        {
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            temperature: 0.55,
            topP: 0.95,
            maxOutputTokens: 500,
          },
        },
        {
          timeout: 12000,
        }
      );

      const text = data?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || '')
        .join('')
        .trim();

      if (!text) {
        lastReason = 'empty_candidate';
        continue;
      }

      return { text, reason: null, model: modelName };
    } catch (err) {
      // Treat HTTP 429 (too many requests) as quota/rate-limited and try next model.
      if (err?.response?.status === 429) {
        lastReason = 'quota_exceeded';
        continue;
      }

      const rawReason = err?.response?.data?.error?.message || err?.message || 'gemini_error';
      const reason = normalizeGeminiReason(rawReason);
      lastReason = reason;

      // Retry with the next model when the model is unavailable or model-specific limits/errors occur.
      if (reason === 'model_unavailable' || reason === 'quota_exceeded' || reason === 'gemini_error') {
        continue;
      }

      // For credential/quota/runtime errors, stop retrying alternate models.
      return { text: null, reason, model: null };
    }
  }

  return { text: null, reason: lastReason, model: null };
};

const extractJsonObject = (raw = '') => {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
};

const normalizeIntent = (value) => {
  const allowed = new Set(['listing_discovery', 'sharing', 'app_qa', 'support_help']);
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.has(normalized) ? normalized : 'app_qa';
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const sanitizeSearchTerms = (terms = []) => {
  const rawTerms = Array.isArray(terms) ? terms : tokenizeQuery(String(terms || ''));
  return [...new Set(rawTerms
    .flatMap((term) => tokenizeQuery(String(term || '')))
    .map(normalizeSearchTerm)
    .filter((term) => term.length >= 3 && !/^\d+$/.test(term) && !STOP_WORDS.has(term) && !LISTING_CATEGORIES.has(term)))]
    .slice(0, 4);
};

const fallbackClassify = (message, history = []) => {
  const intent = detectIntent(message);
  const hints = extractSearchHints(message);
  let searchTerms = intent === 'listing_discovery' ? sanitizeSearchTerms(hints.tokens) : [];

  if (intent === 'listing_discovery' && !searchTerms.length && hasPriceConstraint(message)) {
    const contextualToken = inferListingContextFromHistory(history);
    if (contextualToken) searchTerms = sanitizeSearchTerms([contextualToken]);
  }

  return {
    intent,
    searchQuery: searchTerms.join(' '),
    searchTerms,
    priceMin: hints.priceMin,
    priceMax: hints.priceMax,
    source: 'fallback',
  };
};

const buildClassificationPrompt = ({ message, history }) => {
  const recentUserTurns = Array.isArray(history)
    ? history
      .filter((turn) => turn?.role === 'user' && turn.content)
      .slice(-3)
      .map((turn) => `- ${String(turn.content).slice(0, 180)}`)
      .join('\n')
    : '';

  return [
    'Classify the latest UniConnect assistant message. Return JSON only.',
    'Intents:',
    '- listing_discovery: user wants matching marketplace/rental listing cards, a product search, item availability, or a budget-filtered product result.',
    '- sharing: user wants matching cab/food/product sharing group cards to join, such as "food sharing under 300" or "cab sharing to airport".',
    '- app_qa: user asks what the platform is, how to navigate, how to list/create an item, how to create/list a sharing group, how to share expenses/split bills, how bidding/offers/rentals work, or where a feature lives.',
    '- support_help: user asks about reports, scams, abuse, disputes, account help, moderation, or safety support.',
    'Rules:',
    '- For "how to list/create/sell an item", choose app_qa, not listing_discovery.',
    '- For "how to share expense", "how to split a bill", or "how to list/create a sharing", choose app_qa, not sharing.',
    '- For a short noun like "painting" or "laptop under 30000", choose listing_discovery.',
    '- searchQuery/searchTerms must contain only the product or share target, not generic words like product, listing, platform, app, item, cheap, under, find, or search.',
    '- Do not invent any products or platform labels.',
    'Return exactly this JSON shape:',
    '{"intent":"listing_discovery|sharing|app_qa|support_help","searchQuery":"","searchTerms":[],"priceMin":null,"priceMax":null}',
    recentUserTurns ? `Recent user-only context:\n${recentUserTurns}` : 'Recent user-only context: none',
    `Latest message: ${message}`,
  ].join('\n');
};

const classifyMessage = async ({ message, history }) => {
  const fallback = fallbackClassify(message, history);

  if (!process.env.GEMINI_API_KEY) {
    return fallback;
  }

  const result = await callGemini({
    prompt: buildClassificationPrompt({ message, history }),
    history: [],
    systemPrompt: [
      'You classify UniConnect assistant requests before any product data is fetched.',
      'Return valid JSON only and never include markdown.',
      PLATFORM_GUIDE,
    ].join('\n'),
  });

  const parsed = extractJsonObject(result.text);
  if (!parsed) {
    return { ...fallback, source: 'fallback', classificationReason: result.reason || 'invalid_json' };
  }

  const intent = normalizeIntent(parsed.intent);
  const forceContextualListing = fallback.intent === 'listing_discovery'
    && fallback.searchTerms.length > 0
    && isPriceOnlyListingQuery(message);
  const resolvedIntent = isShareGuidanceQuery(message)
    ? 'app_qa'
    : forceContextualListing
      ? 'listing_discovery'
      : intent;
  const priceMin = toNumberOrNull(parsed.priceMin) ?? fallback.priceMin;
  const priceMax = toNumberOrNull(parsed.priceMax) ?? fallback.priceMax;
  const parsedTerms = sanitizeSearchTerms(parsed.searchTerms?.length ? parsed.searchTerms : parsed.searchQuery);
  const searchTerms = resolvedIntent === 'listing_discovery'
    ? (parsedTerms.length ? parsedTerms : fallback.searchTerms)
    : [];

  return {
    intent: resolvedIntent,
    searchQuery: resolvedIntent === 'listing_discovery'
      ? (searchTerms.join(' ') || String(parsed.searchQuery || '').trim())
      : '',
    searchTerms,
    priceMin,
    priceMax,
    source: 'gemini',
    model: result.model,
  };
};

const cleanReply = (reply = '') => String(reply || '')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/\s+\n/g, '\n')
  .trim();

const isSessionMemoryQuery = (message = '') => {
  const text = String(message || '').toLowerCase();
  return /\b(remember|past messages?|previous messages?|searched before|search history|what have i searched|what did i search|earlier messages?)\b/.test(text);
};

const getRecentUserMessages = (history = []) => {
  if (!Array.isArray(history)) return [];
  return history
    .filter((turn) => turn?.role === 'user' && String(turn.content || '').trim())
    .map((turn) => String(turn.content).trim())
    .filter((content) => !/^(hi|hello|hey|hii|yo|thanks|thank you)\b/i.test(content));
};

const buildSessionMemoryReply = ({ message, history }) => {
  const text = String(message || '').toLowerCase();
  const userMessages = getRecentUserMessages(history);

  if (!userMessages.length) {
    return 'I can remember messages from this open assistant session only, but I do not see any earlier messages in this chat yet.';
  }

  const wantsSearches = /\b(search|searched|find|looked)\b/.test(text);
  const relevantMessages = wantsSearches
    ? userMessages.filter((content) => detectIntent(content) === 'listing_discovery')
    : userMessages;
  const messagesToShow = (relevantMessages.length ? relevantMessages : userMessages).slice(-5);

  if (wantsSearches) {
    return `In this session, you searched for: ${messagesToShow.map((content) => `"${content}"`).join(', ')}.`;
  }

  return `Yes, within this open assistant session. Your recent messages were: ${messagesToShow.map((content) => `"${content}"`).join(', ')}.`;
};

const fallbackReply = ({ message, listings, shares, intent, fallbackReason, route }) => {
  const isListingIntent = /find|show|search|recommend|under|below|above|near|rent/i.test(message);
  const isSharingIntent = /share|sharing|split|bill|group order|cab|ride|food/i.test(message);
  const isGreeting = /^(hi|hello|hey|hii|yo)\b/i.test(String(message || '').trim());
  const text = String(message || '').toLowerCase();
  const searchLabel = route?.searchQuery || sanitizeSearchTerms(tokenizeQuery(message)).join(' ');

  if (isGreeting) {
    return 'Hello! I can help you find listings, explore sharing options, and explain app features. What do you want to do right now?';
  }

  if (/\b(list|create|post|upload|sell)\b/.test(text) && /\b(item|listing|product|sell|rental)\b/.test(text)) {
    return 'To list an item, open My Listings from the navbar, click + Create, then fill the title, description, price, category, listing type, tags, location, and image. For rentals, open Rental and click + Create. There is no Sell button.';
  }

  if (/\bwhat\b.*\b(platform|uniconnect|app)\b/.test(text) || /\bplatform\b.*\b(works?|about)\b/.test(text)) {
    return 'UniConnect is a campus marketplace for students to browse and create listings, rent items, join sharing groups, chat with other users, make offers, bid in auctions, and manage notifications.';
  }

  if (isShareGuidanceQuery(message)) {
    if (/\bjoin|request\b/.test(text)) {
      return 'To join a share, open Sharing, check Available Shares, open the share card, and tap Join. Your request appears under My Requests, and the host can approve or reject it from Received Requests.';
    }

    if (/\bapprove|reject|finalize|complete|manage\b/.test(text)) {
      return 'To manage a share, open Sharing. Your hosted shares are under My Sharing, join requests appear in Received Requests, and you can approve, reject, update, delete, or finalize a share from its card.';
    }

    return 'To share an expense or list a sharing, open Sharing from the navbar, go to My Sharing, click + Create, choose Type of Sharing, enter the total amount and split type, then submit Create Share. Other users can request to join from Available Shares.';
  }

  if (intent === 'sharing' || isSharingIntent) {
    if (shares.length) {
      const topShares = shares.slice(0, 3)
        .map((item) => `${item.name} (${item.shareType}, INR ${item.totalAmount})`)
        .join(', ');
      return `I found active sharing options: ${topShares}. Open Sharing tab and tap Join to request participation.`;
    }
    return 'I can help with sharing. Try a query like "food sharing under 300" or "cab sharing to airport".';
  }

  if ((intent === 'listing_discovery' || isListingIntent) && listings.length) {
    if (listings.length === 1) {
      const [item] = listings;
      return `I found 1 matching listing${searchLabel ? ` for "${searchLabel}"` : ''}: ${item.title} - INR ${item.price}. Open the card below to view details.`;
    }

    const top = listings.slice(0, 3)
      .map((item) => `${item.title} (INR ${item.price})`)
      .join(', ');
    return `I found ${listings.length} matching listings${searchLabel ? ` for "${searchLabel}"` : ''}: ${top}. Open a card below to view details.`;
  }

  if (intent === 'listing_discovery' || isListingIntent) {
    return `I could not find matching listings${searchLabel ? ` for "${searchLabel}"` : ''}. Try a different item or budget, or browse Marketplace filters.`;
  }

  if (/bid|bidding|auction/i.test(message)) {
    return 'For bidding: open a listing marked auction, join live bids, and place a value above current bid before auction end time.';
  }

  if (/report|scam|abuse|safety/i.test(message)) {
    return 'Use Report on the listing page with reason/details. Admin reviews flagged content and you can track updates in notifications.';
  }

  if (/offer|price|negotiate/i.test(message)) {
    return 'Open listing details and send an offer from the offer section. Keep messages clear on amount, pickup timing, and item condition.';
  }

  if (fallbackReason && fallbackReason !== 'empty_candidate') {
    if (intent === 'listing_discovery') {
      if (listings.length) {
        const top = listings.slice(0, 3)
          .map((item) => `${item.title} (INR ${item.price})`)
          .join(', ');
        return `Here are relevant options I found: ${top}. If you want, I can narrow this further by category, condition, or budget.`;
      }
      return 'I can help with product discovery. Tell me item + budget together, for example "chair under 500" or "phone under 12000".';
    }

    if (intent === 'sharing') {
      if (shares.length) {
        const topShares = shares.slice(0, 3)
          .map((item) => `${item.name} (${item.shareType}, INR ${item.totalAmount})`)
          .join(', ');
        return `I found active sharing options: ${topShares}. You can open Sharing and join directly.`;
      }
      return 'I can help with sharing too. Try "food sharing under 300" or "cab sharing to airport".';
    }

    return 'Use Home for an overview, Marketplace to browse listings, My Listings > + Create to list an item, Rental for rentals, Sharing for groups, Chat for messages, Notifications for updates, and Profile for your account/location.';
  }

  return 'Use Home for an overview, Marketplace to browse listings, My Listings > + Create to list an item, Rental for rentals, Sharing for groups, Chat for messages, Notifications for updates, and Profile for your account/location.';
};

const detectIntent = (message) => {
  const text = String(message || '').toLowerCase();
  const tokens = tokenizeQuery(text);
  const isQuestionStyle = /\b(how|what|why|when|where|who|can|does|do|is|are)\b/.test(text);

  if (isShareGuidanceQuery(message)) return 'app_qa';
  if (/share|sharing|split|group order|bill split|cab share|food share|ride share/.test(text)) return 'sharing';
  if (/bid|bidding|auction/.test(text)) return 'app_qa';
  if (/find|show|search|recommend|under|below|above|rent|buy/.test(text)) return 'listing_discovery';
  if (/report|safety|scam|abuse|support|help/.test(text)) return 'support_help';

  // Treat short product-style queries as listing discovery instead of generic help.
  if (tokens.length >= 1 && tokens.length <= 3 && !isQuestionStyle && !/hi|hello|hey|thanks|thank you/.test(text)) {
    return 'listing_discovery';
  }

  if (/\d+/.test(text) && /(₹|rs|inr|under|below|above|over)/.test(text)) {
    return 'listing_discovery';
  }

  return 'app_qa';
};

const generateAssistantReply = async ({ user, message, history }) => {
  if (isSessionMemoryQuery(message)) {
    return {
      intent: 'app_qa',
      reply: buildSessionMemoryReply({ message, history }),
      listings: [],
      shares: [],
      meta: {
        model: 'session-memory',
        responseMode: 'structured',
        fallbackReason: null,
        routeSource: 'session-memory',
        searchQuery: null,
        sessionMemory: 'client-side only',
        timestamp: Date.now(),
      },
    };
  }

  if (isShareGuidanceQuery(message)) {
    return {
      intent: 'app_qa',
      reply: fallbackReply({
        message,
        listings: [],
        shares: [],
        intent: 'app_qa',
        route: { source: 'platform-guide', searchQuery: '' },
      }),
      listings: [],
      shares: [],
      meta: {
        model: 'structured',
        responseMode: 'structured',
        fallbackReason: null,
        routeSource: 'platform-guide',
        searchQuery: null,
        sessionMemory: 'client-side only',
        timestamp: Date.now(),
      },
    };
  }

  const route = await classifyMessage({ message, history });
  const intent = route.intent;
  const listings = await getRelevantListings(message, intent, history, route);
  const shares = await getRelevantShares(message, user, intent);

  if (['listing_discovery', 'sharing'].includes(intent)) {
    return {
      intent,
      reply: fallbackReply({
        message,
        listings,
        shares,
        intent,
        route,
      }),
      listings,
      shares,
      meta: {
        model: 'structured',
        responseMode: 'structured',
        fallbackReason: null,
        routeSource: route.source,
        searchQuery: route.searchQuery || null,
        sessionMemory: 'client-side only',
        timestamp: Date.now(),
      },
    };
  }

  const systemPrompt = buildSystemPrompt({ user, intent });
  const userPrompt = buildUserPrompt({ message, listings, shares, intent, route });

  const geminiResult = await callGemini({
    prompt: userPrompt,
    history,
    systemPrompt,
  });

  let reply = cleanReply(geminiResult.text);
  let responseMode = 'gemini';

  if (!reply) {
    reply = fallbackReply({
      message,
      listings,
      shares,
      intent,
      fallbackReason: geminiResult.reason,
      route,
    });
    responseMode = 'fallback';
  }

  return {
    intent,
    reply,
    listings,
    shares,
    meta: {
      model: responseMode === 'gemini' ? (geminiResult.model || GEMINI_MODEL_ORDER[0]) : 'fallback',
      responseMode,
      fallbackReason: responseMode === 'fallback' ? geminiResult.reason : null,
      routeSource: route.source,
      searchQuery: route.searchQuery || null,
      sessionMemory: 'client-side only',
      timestamp: Date.now(),
    },
  };
};

module.exports = { generateAssistantReply };
