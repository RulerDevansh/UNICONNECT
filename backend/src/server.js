const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { initSocket } = require('./services/socketService');
const { connectDb } = require('./config/db');
const { startCleanupService } = require('./services/cleanupService');
const { corsOriginCallback } = require('./config/cors');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOriginCallback,
    credentials: true,
  },
  connectionStateRecovery: true,
});

initSocket(io);

connectDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`UniConnect backend running on port ${PORT}`);
      startCleanupService();
    });
  })
  .catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
