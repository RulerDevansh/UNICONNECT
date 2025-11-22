const calculateSplit = (share, overrides = []) => {
  const activeMembers = share.members.filter((m) => m.status === 'joined');
  if (!activeMembers.length) return [];

  if (share.splitType === 'equal') {
    const amount = Number((share.totalAmount / activeMembers.length).toFixed(2));
    return activeMembers.map((member) => ({
      ...(typeof member.toObject === 'function' ? member.toObject() : member),
      share: amount,
    }));
  }

  if (share.splitType === 'percentage') {
    return activeMembers.map((member) => {
      const override = overrides.find((o) => o.userId === member.user.toString());
      const pct = override?.percentage || member.percentage || 0;
  const base = typeof member.toObject === 'function' ? member.toObject() : member;
  return { ...base, share: Number(((pct / 100) * share.totalAmount).toFixed(2)) };
    });
  }

  // Custom split with host contribution
  return activeMembers.map((member) => {
    const override = overrides.find((o) => o.userId === member.user.toString());
    const base = typeof member.toObject === 'function' ? member.toObject() : member;
    
    const otherMembersCount = activeMembers.filter(m => m.user.toString() !== share.host.toString()).length;
    
    // If member is the host
    if (member.user.toString() === share.host.toString()) {
      // If host is the only member, they pay the full amount
      if (otherMembersCount === 0) {
        return { ...base, share: Number(share.totalAmount.toFixed(2)) };
      }
      // Otherwise, use host contribution amount
      const hostAmount = share.hostContribution || 0;
      return { ...base, share: Number(hostAmount.toFixed(2)) };
    }
    
    // For other members, calculate remaining amount divided equally
    const hostAmount = share.hostContribution || 0;
    const remainingAmount = share.totalAmount - hostAmount;
    const equalShare = otherMembersCount > 0 ? Number((remainingAmount / otherMembersCount).toFixed(2)) : 0;
    
    return { ...base, share: override?.share || equalShare };
  });
};

module.exports = { calculateSplit };
