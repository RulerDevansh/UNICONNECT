const { updateTransactionStatus } = require('../controllers/transactionController');

const mockCreateNotification = jest.fn();

jest.mock('../models/Notification', () => ({
  create: (...args) => mockCreateNotification(...args),
}));

jest.mock('../services/socketService', () => ({
  getIO: jest.fn(() => null),
}));

jest.mock('../models/Listing', () => ({}));
jest.mock('../models/Offer', () => ({}));
jest.mock('../models/Chat', () => ({}));
jest.mock('../models/Message', () => ({}));

const mockFindById = jest.fn();
jest.mock('../models/Transaction', () => ({
  findById: (...args) => mockFindById(...args),
}));

const createPopulateChain = (transaction) => ({
  populate: jest.fn().mockReturnThis(),
  then: (resolve) => resolve(transaction),
});

const createTransaction = (overrides = {}) => {
  const tx = {
    _id: 'tx1',
    transactionType: 'rental_booking',
    status: 'approved',
    rentalStatus: 'active',
    disputeStatus: 'open',
    depositStatus: 'held',
    depositAmount: 100,
    listing: { _id: 'listing1', title: 'Rental Bike' },
    buyer: { _id: 'buyer1', name: 'Buyer One', email: 'buyer@uni.edu' },
    seller: { _id: 'seller1', name: 'Seller One', email: 'seller@uni.edu' },
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };

  tx.populate = jest.fn().mockResolvedValue(tx);
  return tx;
};

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe('updateTransactionStatus rental dispute actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateNotification.mockResolvedValue({ _id: 'notif1' });
  });

  it('resolves dispute by releasing deposit', async () => {
    const tx = createTransaction({ depositStatus: 'held' });
    mockFindById.mockReturnValue(createPopulateChain(tx));

    const req = {
      params: { id: 'tx1' },
      user: { id: 'seller1' },
      body: { rentalAction: 'resolve_dispute_release' },
    };
    const res = createRes();
    const next = jest.fn();

    await updateTransactionStatus(req, res, next);

    expect(tx.disputeStatus).toBe('resolved');
    expect(tx.depositStatus).toBe('released');
    expect(tx.rentalStatus).toBe('closed');
    expect(tx.status).toBe('completed');
    expect(tx.save).toHaveBeenCalled();
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'buyer1',
        type: 'rental_dispute_resolved',
        transactionRef: 'tx1',
      })
    );
    expect(res.json).toHaveBeenCalledWith(tx);
    expect(next).not.toHaveBeenCalled();
  });

  it('resolves dispute by forfeiting deposit', async () => {
    const tx = createTransaction({ depositStatus: 'held' });
    mockFindById.mockReturnValue(createPopulateChain(tx));

    const req = {
      params: { id: 'tx1' },
      user: { id: 'seller1' },
      body: { rentalAction: 'resolve_dispute_forfeit' },
    };
    const res = createRes();

    await updateTransactionStatus(req, res, jest.fn());

    expect(tx.disputeStatus).toBe('resolved');
    expect(tx.depositStatus).toBe('forfeited');
    expect(tx.rentalStatus).toBe('closed');
    expect(tx.status).toBe('completed');
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'buyer1',
        type: 'rental_deposit_forfeited',
        transactionRef: 'tx1',
      })
    );
    expect(res.json).toHaveBeenCalledWith(tx);
  });

  it('blocks non-owner from resolving rental disputes', async () => {
    const tx = createTransaction();
    mockFindById.mockReturnValue(createPopulateChain(tx));

    const req = {
      params: { id: 'tx1' },
      user: { id: 'buyer1' },
      body: { rentalAction: 'resolve_dispute_release' },
    };
    const res = createRes();

    await updateTransactionStatus(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Only owner can perform this rental action' });
    expect(tx.save).not.toHaveBeenCalled();
  });
});
