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

  return activeMembers.map((member) => {
    const override = overrides.find((o) => o.userId === member.user.toString());
    const base = typeof member.toObject === 'function' ? member.toObject() : member;
    return { ...base, share: override?.share || member.share };
  });
};

module.exports = { calculateSplit };
