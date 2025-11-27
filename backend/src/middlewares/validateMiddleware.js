const { validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const issues = result.array();
    const message = issues.map((issue) => issue.msg).filter(Boolean).join('; ') || 'Validation failed';
    return res.status(422).json({ message, errors: issues });
  }
  next();
};

module.exports = { handleValidation };
