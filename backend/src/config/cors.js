const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost',
  'http://localhost:5000',
  'http://10.0.2.2:3000',
  'http://10.0.2.2:5000',
  'http://10.0.2.2:8081',
  'http://127.0.0.1',
  'https://uniconnect-backend.azurewebsites.net',
];
const envOrigins = [
  process.env.FRONTEND_URL,
  process.env.BACKEND_URL,
  process.env.MOBILE_URL,
  process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : '',
]
  .filter(Boolean)
  .flatMap((value) => value.split(','))
  .map((origin) => origin.trim());

const normalizeOrigin = (origin = '') => origin.replace(/\/+$/, '').toLowerCase();
const allowedOrigins = [...new Set([...defaultCorsOrigins, ...envOrigins].filter(Boolean).map(normalizeOrigin))];

const corsOriginCallback = (origin, callback) => {
  if (!origin) return callback(null, true);
  const normalizedOrigin = normalizeOrigin(origin);
  if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
  if (/^https:\/\/[^/]+\.azurewebsites\.net$/.test(normalizedOrigin)) return callback(null, true);
  if (/^http:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(normalizedOrigin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
};


module.exports = { allowedOrigins, corsOriginCallback };
