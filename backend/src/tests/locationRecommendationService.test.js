let mockUser = null;
let mockListingFindResults = [];
let mockShareFindResults = [];

const createQuery = (resultQueue) => ({
  select: jest.fn().mockReturnThis(),
  populate: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn(async () => resultQueue.shift() || []),
});

jest.mock('../models/User', () => ({
  findById: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn(async () => mockUser),
  })),
}));

jest.mock('../models/Listing', () => ({
  find: jest.fn(() => createQuery(mockListingFindResults)),
}));

jest.mock('../models/Share', () => ({
  find: jest.fn(() => createQuery(mockShareFindResults)),
}));

const Listing = require('../models/Listing');
const Share = require('../models/Share');
const { getLocationBasedRecommendations } = require('../services/locationRecommendationService');

describe('locationRecommendationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      _id: 'u1',
      collegeDomain: 'college.edu',
      location: { latitude: 0, longitude: 0 },
    };
    mockListingFindResults = [];
    mockShareFindResults = [];
  });

  it('uses indexed geo search and haversine filtering for nearby listings', async () => {
    mockListingFindResults = [
      [
        {
          _id: 'far',
          title: 'Too Far',
          status: 'active',
          location: { latitude: 0, longitude: 0.2 },
        },
        {
          _id: 'near',
          title: 'Nearby Book',
          status: 'active',
          location: { latitude: 0, longitude: 0.05 },
        },
      ],
      [
        {
          _id: 'legacy-near',
          title: 'Legacy Nearby',
          status: 'active',
          location: { latitude: 0, longitude: 0.01 },
        },
      ],
    ];
    mockShareFindResults = [[], []];

    const result = await getLocationBasedRecommendations({
      userId: 'u1',
      maxDistanceKm: 10,
      limit: 5,
    });

    expect(Listing.find).toHaveBeenCalledTimes(2);
    expect(Listing.find.mock.calls[0][0]).toMatchObject({
      collegeDomain: 'college.edu',
      status: 'active',
      'location.geo': {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [0, 0] },
          $maxDistance: 10000,
        },
      },
    });
    expect(Listing.find.mock.calls[1][0]['location.latitude']).toEqual(expect.objectContaining({
      $gte: expect.any(Number),
      $lte: expect.any(Number),
    }));
    expect(result.listings.map((listing) => listing._id)).toEqual(['legacy-near', 'near']);
    expect(result.listings[0].distance_km).toBeLessThan(result.listings[1].distance_km);
    expect(result.listings.find((listing) => listing._id === 'far')).toBeUndefined();
    expect(Share.find).toHaveBeenCalledTimes(2);
  });
});
