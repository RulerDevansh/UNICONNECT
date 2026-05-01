const { calculateSplit } = require('../utils/splitCalculator');

describe('calculateSplit', () => {
  it('uses override percentages without changing member order', () => {
    const share = {
      splitType: 'percentage',
      totalAmount: 1000,
      members: [
        { user: 'u1', status: 'joined', percentage: 50 },
        { user: 'u2', status: 'joined', percentage: 20 },
        { user: 'u3', status: 'pending', percentage: 30 },
      ],
    };

    const result = calculateSplit(share, [{ userId: 'u2', percentage: 30 }]);

    expect(result).toHaveLength(2);
    expect(result.map((member) => member.user)).toEqual(['u1', 'u2']);
    expect(result.map((member) => member.share)).toEqual([500, 300]);
  });

  it('uses custom overrides while preserving host contribution behavior', () => {
    const share = {
      splitType: 'custom',
      totalAmount: 900,
      host: 'u1',
      hostContribution: 300,
      members: [
        { user: 'u1', status: 'joined' },
        { user: 'u2', status: 'joined' },
        { user: 'u3', status: 'joined' },
      ],
    };

    const result = calculateSplit(share, [{ userId: 'u3', share: 450 }]);

    expect(result.map((member) => member.share)).toEqual([300, 300, 450]);
  });
});
