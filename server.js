const http = require('http');
const app = require('./src/app');
const { initSocket } = require('./src/socket');
const logger = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// مجلد اللوغات
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const PORT = process.env.PORT || 5000;

// HTTP server + Socket.IO
const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  logger.info(`🚌 Server running on port ${PORT}`);
  logger.info(`📚 API Docs: http://localhost:${PORT}/api/docs`);
  logger.info(`🔌 WebSocket: ws://localhost:${PORT}`);
});
