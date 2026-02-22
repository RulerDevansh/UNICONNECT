const defaultCorsOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];
const envOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim()) : [];
const allowedOrigins = [...new Set([...defaultCorsOrigins, ...envOrigins].filter(Boolean))];

const corsOriginCallback = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  return callback(new Error('Not allowed by CORS'));
};

module.exports = { allowedOrigins, corsOriginCallback };
