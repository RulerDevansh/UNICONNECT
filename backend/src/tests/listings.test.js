const request = require('supertest');

const mockCursor = {
  populate: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([]),
};

jest.mock('../models/Listing', () => ({
  find: jest.fn(() => mockCursor),
  countDocuments: jest.fn().mockResolvedValue(0),
}));

const app = require('../app');

describe('GET /api/listings', () => {
  it('returns list payload', async () => {
    mockCursor.limit.mockResolvedValueOnce([{ title: 'Item' }]);
    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });
});
