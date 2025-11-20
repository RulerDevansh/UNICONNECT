const { body } = require('express-validator');

const registerValidationRules = () => [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').notEmpty(),
];

const loginValidationRules = () => [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
];

const listingValidationRules = () => [
  body('title').isLength({ min: 3 }),
  body('price').isFloat({ min: 0 }),
  body('category').isIn(['physical', 'digital', 'ticket', 'merch']),
];

const validateListingFilters = (query) => ({
  q: query.q,
  category: query.category,
  tags: query.tags ? query.tags.split(',') : [],
  priceMin: query.priceMin ? Number(query.priceMin) : undefined,
  priceMax: query.priceMax ? Number(query.priceMax) : undefined,
  condition: query.condition,
  collegeDomain: query.collegeId || query.collegeDomain,
});

module.exports = {
  registerValidationRules,
  loginValidationRules,
  listingValidationRules,
  validateListingFilters,
};
