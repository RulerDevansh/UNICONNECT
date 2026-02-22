const toPlain = (member) =>
  typeof member.toObject === 'function' ? member.toObject() : member;

const calculateSplit = (share, overrides = []) => {
  const activeMembers = share.members.filter((m) => m.status === 'joined');
  if (!activeMembers.length) return [];

  if (share.splitType === 'equal') {
    const amount = Number((share.totalAmount / activeMembers.length).toFixed(2));
    return activeMembers.map((member) => ({
      ...toPlain(member),
      share: amount,
    }));
  }

  if (share.splitType === 'percentage') {
    return activeMembers.map((member) => {
      const override = overrides.find((o) => o.userId === member.user.toString());
      const pct = override?.percentage ?? member.percentage ?? 0;
      return {
        ...toPlain(member),
        share: Number(((pct / 100) * share.totalAmount).toFixed(2)),
      };
    });
  }

  // Custom split with host contribution
  const hostId = share.host.toString();
  const otherMembersCount = activeMembers.filter((m) => m.user.toString() !== hostId).length;
  const hostAmount = share.hostContribution ?? 0;
  const remainingAmount = share.totalAmount - hostAmount;
  const equalShare = otherMembersCount > 0
    ? Number((remainingAmount / otherMembersCount).toFixed(2))
    : 0;

  return activeMembers.map((member) => {
    const override = overrides.find((o) => o.userId === member.user.toString());
    const base = toPlain(member);

    if (member.user.toString() === hostId) {
      if (otherMembersCount === 0) {
        return { ...base, share: Number(share.totalAmount.toFixed(2)) };
      }
      return { ...base, share: Number(hostAmount.toFixed(2)) };
    }

    return { ...base, share: override?.share ?? equalShare };
  });
};

module.exports = { calculateSplit };
