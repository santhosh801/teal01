const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const eventBus = require('./utils/eventBus');
const marketFeedClient = require('./services/marketFeedClient');
const alertService = require('./services/alertService');

/* ── Global crash guards ─────────────────────────────────────────── */
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: String(reason) });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO Server for downstream real-time alerts & clients
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Setup socket connection for downstream clients
io.on('connection', (socket) => {
  logger.info(`Downstream client connected: ${socket.id}`);

  // Send latest 10 alerts immediately upon connection
  socket.emit('initial_alerts', alertService.getLatestAlerts());

  socket.on('disconnect', (reason) => {
    logger.info(`Downstream client disconnected: ${socket.id}`, { reason });
  });
});

// Forward price updates from feed to all downstream clients
eventBus.on('price_update', (tickData) => {
  io.emit('price_update', tickData);
});

// Hook into alert generation to broadcast alerts in real-time
const originalCreateAlert = alertService.createAlert.bind(alertService);
alertService.createAlert = (alertData) => {
  const alert = originalCreateAlert(alertData);
  io.emit('new_alert', alert);
  return alert;
};

// Start Server function
function startServer() {
  const PORT = config.server.port;

  server.listen(PORT, () => {
    logger.info(`Trackz Backend Platform running on port ${PORT}`);

    // Connect to upstream market data feed
    try {
      marketFeedClient.connect();
    } catch (err) {
      logger.error('Failed to connect to market feed', { error: err.message });
    }

    // Create a bootstrap alert to verify alert service on boot
    try {
      alertService.createAlert({
        symbol: 'RELIANCE',
        type: 'SYSTEM',
        description: 'Trackz Backend System online. Connection to stock data feed initialized.',
        value: 0,
        threshold: 0
      });
    } catch (err) {
      logger.error('Failed to create bootstrap alert', { error: err.message });
    }
  });
}

// Handle shutdown cleanly
const shutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down server gracefully...`);

  // Close feed client
  marketFeedClient.disconnect();

  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
