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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns list payload', async () => {
    mockCursor.limit.mockResolvedValueOnce([{ title: 'Item' }]);
    const res = await request(app).get('/api/listings');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
  });

  it('applies listingType filter for rental listings', async () => {
    mockCursor.limit.mockResolvedValueOnce([{ title: 'Rental Cycle', listingType: 'rental' }]);
    const res = await request(app).get('/api/listings?listingType=rental');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    const findCallArg = require('../models/Listing').find.mock.calls[0][0];
    expect(findCallArg.listingType).toBe('rental');
  });
});
