const xss = require('xss');

const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script'],
};

const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    return xss(value, xssOptions);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, val]) => {
      acc[key] = sanitizeValue(val);
      return acc;
    }, {});
  }
  return value;
};

const xssClean = (req, _res, next) => {
  ['body', 'query', 'params'].forEach((key) => {
    if (req[key]) {
      req[key] = sanitizeValue(req[key]);
    }
  });
  next();
};

module.exports = { xssClean };
