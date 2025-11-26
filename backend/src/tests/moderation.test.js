const axios = require('axios');

jest.mock('axios');

describe('checkAlcoholImage', () => {
  beforeEach(() => {
    jest.resetModules();
    axios.post.mockReset();
    process.env.ML_SERVICE_URL = 'http://ml-service';
  });

  it('marks beer bottle predictions as blocked', async () => {
    axios.post.mockResolvedValue({
      data: {
        predicted_label: 'Beer Bottle',
        confidence: 0.95,
        is_beer: true,
        flagged: true,
        scores: { 'Beer Bottle': 0.95, 'Plastic Bottle': 0.05 },
      },
    });

    let checkAlcoholImage;
    jest.isolateModules(() => {
      ({ checkAlcoholImage } = require('../services/moderationService'));
    });

    const result = await checkAlcoholImage('https://example.com/image.jpg');
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('beer_bottle_detected');
    expect(result.predicted_label).toBe('Beer Bottle');
    expect(result.confidence).toBeCloseTo(0.95);
    expect(result.recommendation).toMatch(/Beer bottles are not allowed/);
  });
});

describe('createListing alcohol policy', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('returns 400 when the primary image is flagged as beer bottle', async () => {
    const listingDoc = {
      _id: 'listing123',
      title: 'Party supplies',
      description: 'Sample desc',
      images: [{ url: 'https://cdn.example.com/beer.jpg' }],
      status: 'active',
      save: jest.fn().mockResolvedValue(true),
    };

    const listingModelMock = {
      create: jest.fn().mockResolvedValue(listingDoc),
      find: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      findOneAndDelete: jest.fn(),
      countDocuments: jest.fn(),
    };

    const reportFindOneLean = jest.fn().mockResolvedValue(null);
    const reportModelMock = {
      findOne: jest.fn(() => ({ lean: reportFindOneLean })),
      create: jest.fn().mockResolvedValue({}),
    };

    const serviceMock = {
      checkAlcoholImage: jest.fn().mockResolvedValue({
        blocked: true,
        predicted_label: 'Beer Bottle',
        confidence: 0.91,
        flagged: true,
      }),
      callModeration: jest.fn().mockResolvedValue({ flagged: false }),
      proxyRecommendations: jest.fn(),
    };

    jest.doMock('../models/Listing', () => listingModelMock);
    jest.doMock('../models/Offer', () => ({}));
    jest.doMock('../models/Chat', () => ({}));
    jest.doMock('../models/Message', () => ({}));
    jest.doMock('../models/Report', () => reportModelMock);
    jest.doMock('../services/moderationService', () => serviceMock);

    let createListing;
    jest.isolateModules(() => {
      ({ createListing } = require('../controllers/listingController'));
    });

    const req = {
      body: {
        title: 'Beer bottle listing',
        description: 'Should be blocked',
        price: 25,
        category: 'physical',
      },
      user: { id: 'user123', collegeDomain: 'uni.edu' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await createListing(req, res, jest.fn());

    expect(serviceMock.checkAlcoholImage).toHaveBeenCalledWith('https://cdn.example.com/beer.jpg');
    expect(listingDoc.status).toBe('blocked');
    expect(listingDoc.mlFlag).toBe(true);
    expect(reportModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'beer_bottle_detected', listing: 'listing123' })
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'beer_bottle_detected', message: expect.stringContaining('beer bottle') })
    );
  });
});