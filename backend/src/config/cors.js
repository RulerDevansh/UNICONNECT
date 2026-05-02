const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5000',
  'http://10.0.2.2:3000',
  'http://10.0.2.2:5000',
  'http://10.0.2.2:8081',
  'http://127.0.0.1',
];
const envOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim()) : [];
const allowedOrigins = [...new Set([...defaultCorsOrigins, ...envOrigins].filter(Boolean))];

const corsOriginCallback = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.some(allowed => origin.includes(allowed))) return callback(null, true);
  if (process.env.NODE_ENV !== 'production') {
    if (origin.includes('localhost') || origin.includes('10.0.2.2') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
  }
  return callback(new Error('Not allowed by CORS'));
};


module.exports = { allowedOrigins, corsOriginCallback };
