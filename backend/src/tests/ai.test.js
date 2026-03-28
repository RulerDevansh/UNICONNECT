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

  beforeEach(() => {
    mockListings = [];
    mockShares = [];
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_ASSISTANT_ENABLED;
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
    expect(res.body.meta.model).toBe('fallback');
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
      .send({ message: 'charts' });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('listing_discovery');
    expect(Array.isArray(res.body.listings)).toBe(true);
    expect(res.body.listings[0].title).toBe('Study Chair');
  });

  it('treats question-style query as app guidance instead of listing intent', async () => {
    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'how this platform works' });

    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('app_qa');
    expect(res.body.reply).toMatch(/i can still help|did not fully understand|help/i);
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

  it('returns gemini response when api key is configured', async () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    axios.post.mockResolvedValue({
      data: {
        candidates: [
          {
            content: {
              parts: [{ text: 'Use Marketplace filters and set budget to INR 4000.' }],
            },
          },
        ],
      },
    });

    const token = buildToken();
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'how can I find cheap bikes?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/marketplace filters/i);
    expect(res.body.meta.model).toBeTruthy();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});
