const Share = require('../models/Share');
const Chat = require('../models/Chat');
const { calculateSplit } = require('../utils/splitCalculator');

/**
 * @route POST /api/shares
 * @body { name, description, totalAmount, splitType }
 */
/**
 * @route GET /api/shares
 */
const listShares = async (req, res, next) => {
  try {
    const shares = await Share.find({ collegeDomain: req.user.collegeDomain })
      .populate('members.user', 'name email')
      .populate('pendingRequests', 'name email')
      .populate('host', 'name email')
      .sort('-createdAt');
    res.json(shares);
  } catch (err) {
    next(err);
  }
};

/**
 * @route GET /api/shares/:id
 */
const getShare = async (req, res, next) => {
  try {
    const share = await Share.findById(req.params.id).populate('members.user', 'name email');
    if (!share) return res.status(404).json({ message: 'Share not found' });
    if (share.collegeDomain !== req.user.collegeDomain) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.json(share);
  } catch (err) {
    next(err);
  }
};

const createShare = async (req, res, next) => {
  try {
    if (Number(req.body.totalAmount) <= 0) {
      return res.status(422).json({ message: 'totalAmount must be positive' });
    }

    const share = await Share.create({
      ...req.body,
      host: req.user.id,
      collegeDomain: req.user.collegeDomain,
      members: [{ user: req.user.id, status: 'joined' }],
    });
    
    // Calculate splits for host (handles host-only scenario)
    share.members = calculateSplit(share, []);
    await share.save();
    
    await Chat.create({
      participants: [req.user.id],
      isGroup: true,
      shareRef: share._id,
    });
    res.status(201).json(share);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/shares/:id/join
 */
const requestJoin = async (req, res, next) => {
  try {
    const share = await Share.findById(req.params.id);
    if (!share) return res.status(404).json({ message: 'Share not found' });
    if (share.collegeDomain !== req.user.collegeDomain) {
      return res.status(403).json({ message: 'College domain mismatch' });
    }
    if (share.status === 'closed') {
      return res.status(400).json({ message: 'Share closed' });
    }
    
    // Check booking deadline for cab sharing
    if (share.shareType === 'cab' && share.bookingDeadline) {
      if (new Date() > new Date(share.bookingDeadline)) {
        return res.status(400).json({ message: 'Booking deadline has passed' });
      }
    }
    
    if (share.members.some((member) => member.user.toString() === req.user.id)) {
      return res.status(400).json({ message: 'Already a member' });
    }
    if (share.pendingRequests.some((id) => id.toString() === req.user.id)) {
      return res.status(409).json({ message: 'Already requested' });
    }
    share.pendingRequests.push(req.user.id);
    await share.save();
    res.json({ message: 'Request submitted' });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/shares/:id/cancel
 * Cancel user's join request or membership
 */
const cancelRequest = async (req, res, next) => {
  try {
    const share = await Share.findById(req.params.id);
    if (!share) return res.status(404).json({ message: 'Share not found' });
    if (share.collegeDomain !== req.user.collegeDomain) {
      return res.status(403).json({ message: 'College domain mismatch' });
    }
    
    // Check if user is in pending requests
    const pendingIndex = share.pendingRequests.findIndex(
      (id) => id.toString() === req.user.id
    );
    
    // Check if user is an approved member
    const memberIndex = share.members.findIndex(
      (member) => member.user.toString() === req.user.id
    );
    
    if (pendingIndex === -1 && memberIndex === -1) {
      return res.status(400).json({ message: 'You are not part of this share' });
    }
    
    // Remove from pending requests if found
    if (pendingIndex !== -1) {
      share.pendingRequests.splice(pendingIndex, 1);
    }
    
    // Mark member as cancelled instead of removing
    if (memberIndex !== -1) {
      share.members[memberIndex].status = 'cancelled';
      share.members[memberIndex].share = 0; // Set share to 0 for cancelled members
      
      // Automatically recalculate splits for active (joined) members to preserve total amount
      // - Equal split: Total amount divided equally among active members
      // - Custom split: Remaining amount (after host contribution) divided equally
      // - Percentage split: Percentages recalculated based on total amount
      const activeMembers = share.members.filter(m => m.status === 'joined');
      if (activeMembers.length > 0) {
        const updatedMembers = calculateSplit(share, []);
        // Update only the active members' shares
        share.members = share.members.map(member => {
          if (member.status === 'joined') {
            const updated = updatedMembers.find(um => 
              um.user.toString() === member.user.toString()
            );
            return updated || member;
          }
          return member;
        });
        share.markModified('members');
      }
      
      // Remove from chat participants but keep cancelled member in members array for history
      await Chat.findOneAndUpdate(
        { shareRef: share._id },
        { $pull: { participants: req.user.id } }
      );
    }
    
    await share.save();
    
    // Note: Cancelled members remain visible until departure time passes
    // Share and chat data deletion is handled by cleanup service after departure time
    // This allows users to view their cancelled booking history until the trip departs
    
    res.json({ message: 'Booking cancelled successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/shares/:id/approve
 * @body { userId }
 */
const approveMember = async (req, res, next) => {
  try {
    const share = await Share.findOne({ _id: req.params.id, host: req.user.id });
    if (!share) return res.status(404).json({ message: 'Share not found' });
    if (share.status === 'closed') {
      return res.status(400).json({ message: 'Share closed' });
    }
    const userId = req.body.userId;
    if (share.members.some((member) => member.user.toString() === userId)) {
      return res.status(400).json({ message: 'Already member' });
    }
    if (!share.pendingRequests.some((id) => id.toString() === userId)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    share.pendingRequests = share.pendingRequests.filter((id) => id.toString() !== userId);
    share.members.push({ user: userId, status: 'joined' });
    
    // Calculate splits for all members after adding new member
    share.members = calculateSplit(share, []);
    share.markModified('members');
    
    // For cab sharing, check if all seats are filled and cancel remaining requests
    if (share.shareType === 'cab' && share.maxPassengers) {
      const isFullyBooked = share.members.length >= share.maxPassengers;
      if (isFullyBooked && share.pendingRequests.length > 0) {
        // Clear all remaining pending requests
        share.pendingRequests = [];
      }
    }
    
    await share.save();
    await Chat.findOneAndUpdate(
      { shareRef: share._id },
      { $addToSet: { participants: userId } },
      { upsert: true }
    );
    
    // Populate and return updated share
    const updatedShare = await Share.findById(share._id)
      .populate('members.user', 'name email')
      .populate('pendingRequests', 'name email')
      .populate('host', 'name email');
    
    res.json(updatedShare);
  } catch (err) {
    next(err);
  }
};

/**
 * @route POST /api/shares/:id/finalize
 * @body { overrides?: [{ userId, share, percentage }] }
 */
const finalizeShare = async (req, res, next) => {
  try {
    const share = await Share.findOne({ _id: req.params.id, host: req.user.id });
    if (!share) return res.status(404).json({ message: 'Share not found' });
    if (share.status === 'closed') {
      return res.status(400).json({ message: 'Share already closed' });
    }
    share.members = calculateSplit(share, req.body.overrides || []);
  share.markModified('members');
    share.status = 'closed';
    await share.save();
    res.json(share);
  } catch (err) {
    next(err);
  }
};

/**
 * @route PUT /api/shares/:id
 */
const updateShare = async (req, res, next) => {
  try {
    const share = await Share.findOne({ _id: req.params.id, host: req.user.id });
    if (!share) {
      return res.status(404).json({ message: 'Share not found or you are not the host' });
    }
    
    // Update fields
    const allowedUpdates = [
      'name', 'description', 'totalAmount', 'splitType', 'shareType',
      'fromCity', 'toCity', 'departureTime', 'arrivalTime', 'maxPassengers', 'vehicleType',
      'foodItems', 'quantity', 'discount', 'cuisineType', 'deliveryTime',
      'productName', 'productCategory', 'bulkQuantity', 'pricePerUnit',
      'category'
    ];
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        share[field] = req.body[field];
      }
    });
    
    await share.save();
    const updatedShare = await Share.findById(share._id)
      .populate('members.user', 'name email')
      .populate('pendingRequests', 'name email')
      .populate('host', 'name email');
    
    res.json(updatedShare);
  } catch (err) {
    next(err);
  }
};

/**
 * @route DELETE /api/shares/:id
 */
const deleteShare = async (req, res, next) => {
  try {
    const share = await Share.findOne({ _id: req.params.id, host: req.user.id });
    if (!share) {
      return res.status(404).json({ message: 'Share not found or you are not the host' });
    }
    await Share.findByIdAndDelete(req.params.id);
    // Also delete the associated chat
    await Chat.deleteOne({ shareRef: req.params.id });
    res.json({ message: 'Share deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listShares,
  getShare,
  createShare,
  requestJoin,
  cancelRequest,
  approveMember,
  finalizeShare,
  updateShare,
  deleteShare,
};
