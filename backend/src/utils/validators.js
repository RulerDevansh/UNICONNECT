const { body } = require('express-validator');

const registerValidationRules = () => [
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
  body('password').isLength({ min: 8 }),
  body('name').notEmpty(),
];

const loginValidationRules = () => [
  body('email').isEmail().normalizeEmail({ gmail_remove_dots: false, gmail_remove_subaddress: false }),
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
  body('listingType')
    .optional()
    .isIn(['buy-now', 'offer', 'auction', 'rental'])
    .withMessage('Listing type must be buy-now, offer, auction, or rental'),
  body('rental.ratePerDay')
    .if(body('listingType').equals('rental'))
    .isFloat({ gt: 0 })
    .withMessage('Rental rate per day must be greater than 0'),
  body('rental.minimumDays')
    .optional()
    .if(body('listingType').equals('rental'))
    .isInt({ min: 1 })
    .withMessage('Minimum rental days must be at least 1'),
  body('rental.securityDeposit')
    .optional()
    .if(body('listingType').equals('rental'))
    .isFloat({ min: 0 })
    .withMessage('Rental security deposit must be greater than or equal to 0'),
  body('rental.availableFrom')
    .optional()
    .if(body('listingType').equals('rental'))
    .isISO8601()
    .withMessage('Rental available from must be a valid date'),
  body('rental.availableUntil')
    .optional()
    .if(body('listingType').equals('rental'))
    .isISO8601()
    .withMessage('Rental available until must be a valid date'),
];

const validateListingFilters = (query) => ({
  q: query.q,
  category: query.category,
  tags: query.tags ? query.tags.split(',') : [],
  priceMin: query.priceMin ? Number(query.priceMin) : undefined,
  priceMax: query.priceMax ? Number(query.priceMax) : undefined,
  condition: query.condition,
  listingType: query.listingType,
  collegeDomain: query.collegeId || query.collegeDomain,
});

module.exports = {
  registerValidationRules,
  loginValidationRules,
  listingValidationRules,
  validateListingFilters,
};
