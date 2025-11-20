const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { initSocket } = require('./services/socketService');
const { connectDb } = require('./config/db');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const defaultCorsOrigins = ['http://localhost:5173', 'http://localhost:5174'];
const envOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim()) : [];
const allowedOrigins = [...new Set([...defaultCorsOrigins, ...envOrigins].filter(Boolean))];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
  connectionStateRecovery: true,
});

initSocket(io);

connectDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`UniConnect backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
