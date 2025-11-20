const paginate = (query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Number(query.limit) || 20);
  const sort = query.sort || 'newest';
  return { page, limit, sort };
};

module.exports = { paginate };
