const axios = require('axios');
const Listing = require('../models/Listing');
const Share = require('../models/Share');

const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';

const GEMINI_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b',
]
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
  'yes', 'no', 'ok', 'okay',
]);

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tokenizeQuery = (message = '') => {
  return String(message)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
};

const hasPriceConstraint = (message = '') => /(?:under|below|less than|above|over|more than)\s*[₹rs\s]*[0-9]+/i.test(String(message));

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

  const categoryKeywords = [
    'bike',
    'cycle',
    'laptop',
    'phone',
    'book',
    'chair',
    'chairs',
    'chart',
    'charts',
    'furniture',
    'electronics',
    'hostel',
  ];

  const category = categoryKeywords.find((word) => text.includes(word)) || null;
  return {
    priceMax: priceUnder ? Number(priceUnder[1]) : null,
    priceMin: priceAbove ? Number(priceAbove[1]) : null,
    category,
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

const getRelevantListings = async (message, intent, history = []) => {
  // For non-listing intents, avoid returning random latest listings cards.
  if (intent !== 'listing_discovery') return [];

  const hints = extractSearchHints(message);
  const query = {
    status: { $nin: ['archived', 'sold', 'blocked'] },
  };

  let contextualToken = null;
  if (!hints.category && !hints.tokens.length && hasPriceConstraint(message)) {
    contextualToken = inferListingContextFromHistory(history);
  }

  if (hints.category || hints.tokens.length || contextualToken) {
    const searchTerms = hints.category
      ? [hints.category, ...hints.tokens.slice(0, 2)]
      : contextualToken
        ? [contextualToken, ...hints.tokens.slice(0, 2)]
        : hints.tokens.slice(0, 3);

    const termRegex = searchTerms.map((term) => ({
      $regex: escapeRegex(term),
      $options: 'i',
    }));

    query.$or = [
      ...termRegex.map((regex) => ({ category: regex })),
      ...termRegex.map((regex) => ({ title: regex })),
      ...termRegex.map((regex) => ({ description: regex })),
      ...termRegex.map((regex) => ({ tags: regex })),
    ];
  } else {
    // Query has no meaningful search signal; avoid unrelated recommendation spam.
    return [];
  }

  if (hints.priceMin || hints.priceMax) {
    query.price = {};
    if (hints.priceMin) query.price.$gte = hints.priceMin;
    if (hints.priceMax) query.price.$lte = hints.priceMax;
  }

  const listings = await Listing.find(query)
    .select('title price category condition images createdAt')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return listings.map((item) => ({
    id: item._id,
    title: item.title,
    price: item.price,
    category: item.category,
    condition: item.condition,
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

const buildSystemPrompt = ({ user }) => {
  const collegeDomain = user?.collegeDomain || 'unknown campus';
  return [
    'You are UniConnect Assistant for a student marketplace app.',
    'Primary tasks: explain product behavior, help users find listings, and provide support guidance.',
    'Never claim to perform transactions. Instead guide the user to relevant app pages and steps.',
    'Be concise and practical in 3-6 lines.',
    `User campus context: ${collegeDomain}`,
  ].join('\n');
};

const buildUserPrompt = ({ message, listings, shares }) => {
  const listingsSummary = listings.length
    ? `Relevant listings:\n${listings
      .map((item, index) => `${index + 1}. ${item.title} | INR ${item.price} | ${item.category}`)
      .join('\n')}`
    : 'Relevant listings: none';

  const sharesSummary = shares.length
    ? `Relevant shares:\n${shares
      .map((item, index) => `${index + 1}. ${item.name} | ${item.shareType} | INR ${item.totalAmount}`)
      .join('\n')}`
    : 'Relevant shares: none';

  return `${listingsSummary}\n${sharesSummary}\n\nUser query: ${message}`;
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

  for (const modelName of GEMINI_MODEL_CANDIDATES) {
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
      const rawReason = err?.response?.data?.error?.message || err?.message || 'gemini_error';
      const reason = normalizeGeminiReason(rawReason);
      lastReason = reason;

      // Retry with next model when the model is unavailable or model-specific limits/errors occur.
      if (reason === 'model_unavailable' || reason === 'quota_exceeded' || reason === 'gemini_error') {
        continue;
      }

      // For credential/quota/runtime errors, stop retrying alternate models.
      return { text: null, reason, model: null };
    }
  }

  return { text: null, reason: lastReason, model: null };
};

const fallbackReply = ({ message, listings, shares, intent, fallbackReason }) => {
  const isListingIntent = /find|show|search|recommend|under|below|above|near|rent/i.test(message);
  const isSharingIntent = /share|sharing|split|bill|group order|cab|ride|food/i.test(message);
  const isGreeting = /^(hi|hello|hey|hii|yo)\b/i.test(String(message || '').trim());

  if (isGreeting) {
    return 'Hello! I can help you find listings, explore sharing options, and explain app features. What do you want to do right now?';
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

  if (isListingIntent && listings.length) {
    const top = listings.slice(0, 3)
      .map((item) => `${item.title} (INR ${item.price})`)
      .join(', ');
    return `I found relevant options: ${top}. Open Marketplace to compare details and message sellers.`;
  }

  if (isListingIntent) {
    return `I could not find a strong match for "${String(message).trim()}". Try a clearer query like "laptop under 30000" or "bike near hostel".`;
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

    return 'I can still help. Ask me in a goal-based way like "find chairs under 500", "food sharing under 300", or "how bidding works".';
  }

  return `I did not fully understand "${String(message || '').trim()}". Try a clearer goal like "find chairs under 500", "food sharing under 300", or "how bidding works".`;
};

const detectIntent = (message) => {
  const text = String(message || '').toLowerCase();
  const tokens = tokenizeQuery(text);
  const isQuestionStyle = /\b(how|what|why|when|where|who|can|does|do|is|are)\b/.test(text);

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
  const intent = detectIntent(message);
  const listings = await getRelevantListings(message, intent, history);
  const shares = await getRelevantShares(message, user, intent);

  const systemPrompt = buildSystemPrompt({ user });
  const userPrompt = buildUserPrompt({ message, listings, shares });

  const geminiResult = await callGemini({
    prompt: userPrompt,
    history,
    systemPrompt,
  });

  let reply = geminiResult.text;
  let responseMode = 'gemini';

  if (!reply) {
    reply = fallbackReply({
      message,
      listings,
      shares,
      intent,
      fallbackReason: geminiResult.reason,
    });
    responseMode = 'fallback';
  }

  return {
    intent,
    reply,
    listings,
    shares,
    meta: {
      model: responseMode === 'gemini' ? (geminiResult.model || GEMINI_MODEL_CANDIDATES[0]) : 'fallback',
      responseMode,
      fallbackReason: responseMode === 'fallback' ? geminiResult.reason : null,
      sessionMemory: 'client-side only',
      timestamp: Date.now(),
    },
  };
};

module.exports = { generateAssistantReply };
