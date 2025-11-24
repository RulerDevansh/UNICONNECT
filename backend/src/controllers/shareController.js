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
      .populate('rejectedRequests.user', 'name email')
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

    // Validate time fields for cab sharing
    if (req.body.shareType === 'cab') {
      const now = new Date();
      
      // Validate departure time is not in the past
      if (req.body.departureTime && new Date(req.body.departureTime) < now) {
        return res.status(400).json({ message: 'Departure time cannot be in the past' });
      }
      
      // Validate arrival time is not in the past
      if (req.body.arrivalTime && new Date(req.body.arrivalTime) < now) {
        return res.status(400).json({ message: 'Arrival time cannot be in the past' });
      }
      
      // Validate booking deadline is not in the past
      if (req.body.bookingDeadline && new Date(req.body.bookingDeadline) < now) {
        return res.status(400).json({ message: 'Booking deadline cannot be in the past' });
      }
      
      // Validate arrival time is after departure time
      if (req.body.departureTime && req.body.arrivalTime) {
        if (new Date(req.body.arrivalTime) <= new Date(req.body.departureTime)) {
          return res.status(400).json({ message: 'Arrival time must be after departure time' });
        }
      }
    }

    // Validate time fields for food sharing
    if (req.body.shareType === 'food') {
      const now = new Date();
      
      // Validate deadline time is not in the past
      if (req.body.deadlineTime && new Date(req.body.deadlineTime) < now) {
        return res.status(400).json({ message: 'Deadline time cannot be in the past' });
      }
    }

    // Validate time fields for other sharing
    if (req.body.shareType === 'other') {
      const now = new Date();
      
      // Validate deadline time is not in the past
      if (req.body.otherDeadline && new Date(req.body.otherDeadline) < now) {
        return res.status(400).json({ message: 'Deadline time cannot be in the past' });
      }
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
    
    // Check deadline for food sharing
    if (share.shareType === 'food' && share.deadlineTime) {
      if (new Date() > new Date(share.deadlineTime)) {
        return res.status(400).json({ message: 'Order deadline has passed' });
      }
    }
    
    // Check if user is an active member (not cancelled)
    const existingMember = share.members.find((member) => member.user.toString() === req.user.id);
    if (existingMember) {
      if (existingMember.status === 'cancelled') {
        // Allow rebooking: remove cancelled member record
        share.members = share.members.filter((member) => member.user.toString() !== req.user.id);
      } else if (existingMember.status === 'joined') {
        return res.status(400).json({ message: 'Already a member' });
      }
    }
    
    if (share.pendingRequests.some((id) => id.toString() === req.user.id)) {
      return res.status(409).json({ message: 'Already requested' });
    }
    
    // Check if user's request was previously rejected (trip was full)
    const rejectedIndex = share.rejectedRequests?.findIndex(
      (rejected) => rejected.user.toString() === req.user.id
    );
    if (rejectedIndex !== undefined && rejectedIndex !== -1) {
      // Allow re-requesting: remove from rejected requests if seats are now available
      const joinedMembersCount = share.members.filter(m => m.status === 'joined').length;
      const isFullyBooked = share.maxPassengers && joinedMembersCount >= share.maxPassengers;
      
      if (isFullyBooked) {
        return res.status(400).json({ 
          message: 'Trip is still fully occupied',
          reason: 'trip_full'
        });
      }
      
      // Remove from rejected requests to allow new request
      share.rejectedRequests.splice(rejectedIndex, 1);
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
    // Check if user is already an active (joined) member
    if (share.members.some((member) => member.user.toString() === userId && member.status === 'joined')) {
      return res.status(400).json({ message: 'Already member' });
    }
    if (!share.pendingRequests.some((id) => id.toString() === userId)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    share.pendingRequests = share.pendingRequests.filter((id) => id.toString() !== userId);
    
    // If user was previously cancelled, update their status instead of adding new entry
    const existingMember = share.members.find((member) => member.user.toString() === userId);
    if (existingMember) {
      existingMember.status = 'joined';
    } else {
      share.members.push({ user: userId, status: 'joined' });
    }
    
    // Calculate splits for all members after adding new member
    share.members = calculateSplit(share, []);
    share.markModified('members');
    
    // For cab sharing, check if all seats are filled and move remaining requests to rejected
    if (share.shareType === 'cab' && share.maxPassengers) {
      const joinedMembersCount = share.members.filter(m => m.status === 'joined').length;
      const isFullyBooked = joinedMembersCount >= share.maxPassengers;
      if (isFullyBooked && share.pendingRequests.length > 0) {
        // Move all remaining pending requests to rejected requests
        // They will be kept until departure time, then cleaned up
        const rejectedUsers = share.pendingRequests.map(userId => ({
          user: userId,
          reason: 'Trip fully occupied',
          rejectedAt: new Date()
        }));
        share.rejectedRequests.push(...rejectedUsers);
        share.pendingRequests = [];
      }
    }
    
    // For food sharing, check if max persons reached and move remaining requests to rejected
    if (share.shareType === 'food' && share.maxPersons) {
      const joinedMembersCount = share.members.filter(m => m.status === 'joined').length;
      const isFullyBooked = joinedMembersCount >= share.maxPersons;
      if (isFullyBooked && share.pendingRequests.length > 0) {
        // Move all remaining pending requests to rejected requests
        // They will be kept until deadline time, then cleaned up
        const rejectedUsers = share.pendingRequests.map(userId => ({
          user: userId,
          reason: 'Order fully occupied',
          rejectedAt: new Date()
        }));
        share.rejectedRequests.push(...rejectedUsers);
        share.pendingRequests = [];
      }
    }
    
    // For other sharing, check if max persons reached and move remaining requests to rejected
    if (share.shareType === 'other' && share.otherMaxPersons) {
      const joinedMembersCount = share.members.filter(m => m.status === 'joined').length;
      const isFullyBooked = joinedMembersCount >= share.otherMaxPersons;
      if (isFullyBooked && share.pendingRequests.length > 0) {
        // Move all remaining pending requests to rejected requests
        // They will be kept until deadline time, then cleaned up
        const rejectedUsers = share.pendingRequests.map(userId => ({
          user: userId,
          reason: 'Share fully occupied',
          rejectedAt: new Date()
        }));
        share.rejectedRequests.push(...rejectedUsers);
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
      .populate('rejectedRequests.user', 'name email')
      .populate('host', 'name email');
    
    res.json(updatedShare);
  } catch (err) {
    next(err);
  }
};

const rejectMember = async (req, res, next) => {
  try {
    const share = await Share.findOne({ _id: req.params.id, host: req.user.id });
    if (!share) return res.status(404).json({ message: 'Share not found' });
    if (share.status === 'closed') {
      return res.status(400).json({ message: 'Share closed' });
    }
    const userId = req.body.userId;
    if (!share.pendingRequests.some((id) => id.toString() === userId)) {
      return res.status(404).json({ message: 'Request not found' });
    }
    
    // Remove from pending requests
    share.pendingRequests = share.pendingRequests.filter((id) => id.toString() !== userId);
    
    // Add to rejected requests
    share.rejectedRequests.push({
      user: userId,
      reason: 'Rejected by host',
      rejectedAt: new Date()
    });
    
    await share.save();
    
    // Populate and return updated share
    const updatedShare = await Share.findById(share._id)
      .populate('members.user', 'name email')
      .populate('pendingRequests', 'name email')
      .populate('rejectedRequests.user', 'name email')
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
    
    // Check minimum persons requirement
    const joinedMembersCount = share.members.filter(m => m.status === 'joined').length;
    
    if (share.shareType === 'food' && share.minPersons) {
      if (joinedMembersCount < share.minPersons) {
        return res.status(400).json({ 
          message: `Cannot complete order. Minimum ${share.minPersons} persons required, but only ${joinedMembersCount} joined.` 
        });
      }
    }
    
    if (share.shareType === 'other' && share.otherMinPersons) {
      if (joinedMembersCount < share.otherMinPersons) {
        return res.status(400).json({ 
          message: `Cannot complete share. Minimum ${share.otherMinPersons} persons required, but only ${joinedMembersCount} joined.` 
        });
      }
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
    
    // Validate maxPassengers for cab sharing
    if (share.shareType === 'cab' && req.body.maxPassengers !== undefined) {
      const joinedMembersCount = share.members.filter(m => m.status === 'joined').length;
      if (req.body.maxPassengers < joinedMembersCount) {
        return res.status(400).json({ 
          message: `Cannot reduce max passengers to ${req.body.maxPassengers}. Currently ${joinedMembersCount} members have joined. Please remove members first or set max passengers to at least ${joinedMembersCount}.`
        });
      }
    }
    
    // Validate time fields for cab sharing
    if (share.shareType === 'cab') {
      const now = new Date();
      
      // Validate departure time is not in the past
      if (req.body.departureTime !== undefined && new Date(req.body.departureTime) < now) {
        return res.status(400).json({ message: 'Departure time cannot be in the past' });
      }
      
      // Validate arrival time is not in the past
      if (req.body.arrivalTime !== undefined && new Date(req.body.arrivalTime) < now) {
        return res.status(400).json({ message: 'Arrival time cannot be in the past' });
      }
      
      // Validate booking deadline is not in the past
      if (req.body.bookingDeadline !== undefined && new Date(req.body.bookingDeadline) < now) {
        return res.status(400).json({ message: 'Booking deadline cannot be in the past' });
      }
      
      // Validate arrival time is after departure time
      const departureTime = req.body.departureTime !== undefined ? req.body.departureTime : share.departureTime;
      const arrivalTime = req.body.arrivalTime !== undefined ? req.body.arrivalTime : share.arrivalTime;
      
      if (departureTime && arrivalTime) {
        if (new Date(arrivalTime) <= new Date(departureTime)) {
          return res.status(400).json({ message: 'Arrival time must be after departure time' });
        }
      }
    }
    
    // Validate time fields for food sharing during update
    if (share.shareType === 'food') {
      const now = new Date();
      
      // Validate deadline time is not in the past
      if (req.body.deadlineTime !== undefined && new Date(req.body.deadlineTime) < now) {
        return res.status(400).json({ message: 'Deadline time cannot be in the past' });
      }
    }
    
    // Validate time fields for other sharing during update
    if (share.shareType === 'other') {
      const now = new Date();
      
      // Validate deadline time is not in the past
      if (req.body.otherDeadline !== undefined && new Date(req.body.otherDeadline) < now) {
        return res.status(400).json({ message: 'Deadline time cannot be in the past' });
      }
    }
    
    // Update fields
    const allowedUpdates = [
      'name', 'description', 'totalAmount', 'splitType', 'shareType',
      'fromCity', 'toCity', 'departureTime', 'arrivalTime', 'bookingDeadline', 'maxPassengers', 'vehicleType',
      'foodItems', 'quantity', 'minPersons', 'maxPersons', 'deadlineTime',
      'productName', 'productCategory', 'bulkQuantity', 'pricePerUnit',
      'category', 'otherMinPersons', 'otherMaxPersons', 'otherDeadline', 'hostContribution'
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
      .populate('rejectedRequests.user', 'name email')
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
  rejectMember,
  finalizeShare,
  updateShare,
  deleteShare,
};
