const request = require('supertest');
const jwt = require('jsonwebtoken');

let mockListings = [];
let mockShares = [];

jest.mock('../models/Listing', () => ({
  find: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn(async () => mockListings),
  })),
}));

jest.mock('../models/Share', () => ({
  find: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn(async () => mockShares),
  })),
}));

jest.mock('axios', () => ({
  post: jest.fn(),
}));

const axios = require('axios');
const app = require('../app');

const buildToken = () => jwt.sign(
  { id: 'u1', role: 'user', collegeDomain: 'college.edu' },
  process.env.JWT_SECRET || 'testsecret'
);

describe('ai endpoint', () => {
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalAssistantEnabled = process.env.AI_ASSISTANT_ENABLED;
  const originalGeminiOrder = process.env.GEMINI_MODEL_ORDER;

  beforeEach(() => {
    mockListings = [];
    mockShares = [];
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_ASSISTANT_ENABLED;
    // Ensure model order exists during tests
    process.env.GEMINI_MODEL_ORDER = 'gemini-2.5-flash,gemini-3-flash-preview,gemini-2.5-flash-lite';
    axios.post.mockReset();
  });

  afterAll(() => {
    if (originalGeminiKey) {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }

    if (originalAssistantEnabled !== undefined) {
      process.env.AI_ASSISTANT_ENABLED = originalAssistantEnabled;
    } else {
      delete process.env.AI_ASSISTANT_ENABLED;
    }

    if (originalGeminiOrder) {
      process.env.GEMINI_MODEL_ORDER = originalGeminiOrder;
    } else {
      delete process.env.GEMINI_MODEL_ORDER;
    }
  });

  it('returns service unavailable when assistant is disabled', async () => {
    process.env.AI_ASSISTANT_ENABLED = 'false';
    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'hello' });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/temporarily disabled/i);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).post('/api/ai/chat').send({ message: 'hello' });
    expect(res.status).toBe(401);
  });

  it('validates message input', async () => {
    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '' });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/message must be between/i);
  });

  it('returns fallback listing guidance when gemini key is missing', async () => {
    mockListings = [
      {
        _id: 'l1',
        title: 'Campus Bike',
        price: 3500,
        category: 'bike',
        condition: 'good',
        images: [],
      },
    ];

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'show bikes under 4000', history: [] });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('listing_discovery');
    expect(Array.isArray(res.body.listings)).toBe(true);
    expect(res.body.listings[0].title).toBe('Campus Bike');
    expect(res.body.meta.model).toBe('structured');
    expect(res.body.reply).toMatch(/campus bike/i);
  });

  it('does not return unrelated listing cards for non-listing query', async () => {
    mockListings = [
      {
        _id: 'l1',
        title: 'Campus Bike',
        price: 3500,
        category: 'bike',
        condition: 'good',
        images: [],
      },
    ];

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'how does bidding work?' });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('app_qa');
    expect(res.body.listings).toEqual([]);
    expect(res.body.reply).toMatch(/for bidding/i);
  });

  it('returns sharing intent with relevant share suggestions', async () => {
    mockShares = [
      {
        _id: 's1',
        name: 'Mess Group Order',
        shareType: 'food',
        totalAmount: 180,
        foodItems: 'Pizza combo',
        members: [{ status: 'joined' }, { status: 'joined' }],
        maxPersons: 5,
      },
    ];

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'sharing food under 200' });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('sharing');
    expect(Array.isArray(res.body.shares)).toBe(true);
    expect(res.body.shares[0].name).toBe('Mess Group Order');
    expect(res.body.reply).toMatch(/active sharing options/i);
  });

  it.each([
    'how to share expense',
    'how to list a sharing',
  ])('answers share how-to query as app guidance: %s', async (message) => {
    mockShares = [
      {
        _id: 's1',
        name: 'Mess Group Order',
        shareType: 'food',
        totalAmount: 180,
        foodItems: 'Pizza combo',
        members: [{ status: 'joined' }],
        maxPersons: 5,
      },
    ];

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('app_qa');
    expect(res.body.shares).toEqual([]);
    expect(res.body.reply).toMatch(/sharing/i);
    expect(res.body.reply).toMatch(/my sharing/i);
    expect(res.body.reply).toMatch(/\+ create/i);
    expect(res.body.reply).toMatch(/create share/i);
    expect(res.body.reply).not.toMatch(/try a query/i);
  });

  it('does not send share how-to guidance through gemini routing', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'how to share expense' });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('app_qa');
    expect(res.body.meta.routeSource).toBe('platform-guide');
    expect(res.body.reply).toMatch(/my sharing/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('treats short product query as listing discovery', async () => {
    mockListings = [
      {
        _id: 'l9',
        title: 'Study Chair',
        price: 450,
        category: 'furniture',
        condition: 'good',
        images: [],
      },
    ];

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'chair' });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('listing_discovery');
    expect(Array.isArray(res.body.listings)).toBe(true);
    expect(res.body.listings[0].title).toBe('Study Chair');
  });

  it('filters assistant listing cards to the requested product', async () => {
    mockListings = [
      {
        _id: 'l20',
        title: 'painting',
        description: 'Acrylic wall painting',
        price: 1000,
        category: 'physical',
        condition: 'good',
        listingType: 'buy-now',
        images: [],
      },
      {
        _id: 'l21',
        title: 'Laptop DELL',
        description: 'Working laptop',
        price: 25000,
        category: 'physical',
        condition: 'good',
        listingType: 'buy-now',
        images: [],
      },
      {
        _id: 'l22',
        title: 'Home',
        description: 'Room decor item',
        price: 400,
        category: 'physical',
        condition: 'good',
        listingType: 'buy-now',
        images: [],
      },
    ];

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'painting' });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('listing_discovery');
    expect(res.body.listings).toHaveLength(1);
    expect(res.body.listings[0]).toEqual(expect.objectContaining({
      id: 'l20',
      title: 'painting',
      price: 1000,
    }));
    expect(res.body.reply).toMatch(/painting/i);
    expect(res.body.reply).toMatch(/open the card below/i);
  });

  it('handles price-only product queries without a hardcoded item name', async () => {
    mockListings = [
      {
        _id: 'l11',
        title: 'Notebook Bundle',
        price: 250,
        category: 'stationery',
        condition: 'new',
        images: [],
      },
    ];

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'products under 3000' });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('listing_discovery');
    expect(res.body.listings[0].title).toBe('Notebook Bundle');
    expect(res.body.reply).not.toMatch(/try a clearer query/i);
  });

  it('keeps listing reply text aligned with all returned cards', async () => {
    mockListings = [
      {
        _id: 'l30',
        title: 'Home',
        description: 'Room decor item',
        price: 400,
        category: 'physical',
        condition: 'good',
        listingType: 'rental',
        images: [],
      },
      {
        _id: 'l31',
        title: 'painting',
        description: 'Canvas painting',
        price: 1000,
        category: 'physical',
        condition: 'good',
        listingType: 'buy-now',
        images: [],
      },
    ];

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'products under 1000' });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('listing_discovery');
    expect(res.body.listings).toHaveLength(2);
    expect(res.body.reply).toMatch(/home/i);
    expect(res.body.reply).toMatch(/painting/i);
    expect(res.body.reply).not.toMatch(/home \(rental\)/i);
  });

  it('treats question-style query as app guidance instead of listing intent', async () => {
    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'how this platform works' });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('app_qa');
    expect(res.body.reply).toMatch(/campus marketplace/i);
  });

  it('uses the real create listing path instead of a sell button', async () => {
    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'how to list an item' });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('app_qa');
    expect(res.body.reply).toMatch(/my listings/i);
    expect(res.body.reply).toMatch(/\+ create/i);
    expect(res.body.reply).toMatch(/there is no sell button/i);
  });

  it('uses history context for price-only follow-up queries', async () => {
    mockListings = [
      {
        _id: 'l10',
        title: 'Wooden Chair',
        price: 450,
        category: 'furniture',
        condition: 'good',
        images: [],
      },
    ];

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'under 500',
        history: [
          { role: 'user', content: 'show chair options' },
          { role: 'assistant', content: 'Sure, checking now.' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('listing_discovery');
    expect(Array.isArray(res.body.listings)).toBe(true);
    expect(res.body.listings[0].title).toBe('Wooden Chair');
  });

  it('keeps contextual product terms when gemini classifies a price-only follow-up', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    axios.post.mockResolvedValueOnce({
      data: {
        candidates: [
          {
            content: {
              parts: [{ text: '{"intent":"listing_discovery","searchQuery":"","searchTerms":[],"priceMin":null,"priceMax":50000}' }],
            },
          },
        ],
      },
    });
    mockListings = [
      {
        _id: 'l40',
        title: 'painting',
        description: 'Canvas painting',
        price: 1000,
        category: 'physical',
        condition: 'good',
        listingType: 'buy-now',
        images: [],
      },
      {
        _id: 'l41',
        title: 'Laptop DELL',
        description: 'Working laptop',
        price: 25000,
        category: 'physical',
        condition: 'good',
        listingType: 'buy-now',
        images: [],
      },
    ];

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'under 50000',
        history: [
          { role: 'user', content: 'painting' },
          { role: 'assistant', content: 'I found 1 matching listing for "painting".' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('listing_discovery');
    expect(res.body.meta.searchQuery).toBe('painting');
    expect(res.body.listings).toHaveLength(1);
    expect(res.body.listings[0].title).toBe('painting');
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('answers session memory questions from chat history', async () => {
    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'what have i searched before',
        history: [
          { role: 'user', content: 'products under 1000' },
          { role: 'assistant', content: 'I found 2 matching listings.' },
          { role: 'user', content: 'painting' },
          { role: 'assistant', content: 'I found 1 matching listing.' },
          { role: 'user', content: 'do you remember my past messages' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('app_qa');
    expect(res.body.meta.model).toBe('session-memory');
    expect(res.body.reply).toMatch(/products under 1000/i);
    expect(res.body.reply).toMatch(/painting/i);
    expect(res.body.reply).not.toMatch(/marketplace page/i);
  });

  it('returns gemini response for app guidance when api key is configured', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    axios.post.mockResolvedValueOnce({
      data: {
        candidates: [
          {
            content: {
              parts: [{ text: '{"intent":"app_qa","searchQuery":"","searchTerms":[],"priceMin":null,"priceMax":null}' }],
            },
          },
        ],
      },
    });
    axios.post.mockResolvedValueOnce({
      data: {
        candidates: [
          {
            content: {
              parts: [{ text: 'Open Profile from the navbar to update your account and location.' }],
            },
          },
        ],
      },
    });

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'how do I update my profile?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/open profile/i);
    expect(res.body.meta.model).toBeTruthy();
    expect(res.body.meta.routeSource).toBe('gemini');
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});
