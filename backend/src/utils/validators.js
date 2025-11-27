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
  body('title')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Title must be at least 3 characters long'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a number greater than or equal to 0'),
  body('category')
    .isIn(['physical', 'digital', 'ticket', 'merch'])
    .withMessage('Category must be physical, digital, ticket or merch'),
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
