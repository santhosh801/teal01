const { io } = require('socket.io-client');
const config = require('../config');
const logger = require('../utils/logger');
const symbolState = require('../state/symbolState');
const detectionEngine = require('../detection/detectionEngine');
const eventBus = require('../utils/eventBus');
const normalizer = require('./normalizer');

class MarketFeedClient {
  constructor() {
    this.socket = null;
    this.url = config.feed.url;
    this.symbols = config.feed.symbols;
    this.connected = false;
    this.tickCount = 0;
    this.lastTickTime = null;
    this.lastTickSymbol = null;
    this.connectTime = null;
    this.errors = [];
  }

  /** Returns operational status for the /feed-status diagnostic endpoint. */
  getStatus() {
    return {
      upstreamUrl: this.url,
      symbols: this.symbols,
      connected: this.connected,
      socketId: this.socket?.id || null,
      transport: this.socket?.io?.engine?.transport?.name || null,
      tickCount: this.tickCount,
      lastTickTime: this.lastTickTime,
      lastTickSymbol: this.lastTickSymbol,
      connectTime: this.connectTime,
      recentErrors: this.errors.slice(-5),
    };
  }

  /**
   * Initialize and connect to the market data feed.
   */
  connect() {
    logger.info(`Connecting to Trackz Market Feed at ${this.url}...`);

    this.socket = io(this.url, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    /* ── Trace all incoming events at debug level ── */
    this.socket.onAny((eventName, ...args) => {
      try {
        if (eventName !== 'ticker') {
          const preview = args.length > 0 ? JSON.stringify(args[0])?.substring(0, 200) : '(no args)';
          logger.debug(`Feed event: "${eventName}"`, { preview });
        }
      } catch (_) { /* swallow logging errors */ }
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this.connectTime = new Date().toISOString();
      logger.info('Connected to upstream market feed', {
        id: this.socket.id,
        transport: this.socket.io.engine.transport.name,
      });
      this.subscribe();
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      logger.warn('Disconnected from Trackz Market Feed', { reason });
    });

    this.socket.on('connect_error', (error) => {
      this.errors.push({ time: new Date().toISOString(), msg: error.message });
      logger.error('Trackz Market Feed connection error', { message: error.message });
    });

    this.socket.on('ticker', (data) => {
      try {
        this.handleTickerData(data);
      } catch (err) {
        logger.error('Error in ticker handler', { error: err.message });
      }
    });
  }

  /**
   * Subscribe to configured stock symbols.
   * The upstream server expects a SINGLE emit with an array of symbols.
   */
  subscribe() {
    if (!this.socket || !this.connected) {
      logger.warn('Cannot subscribe, socket is not connected');
      return;
    }

    logger.info(`Subscribing to symbols: [${this.symbols.join(', ')}]`);
    this.socket.emit('subscribe', this.symbols);
  }

  /**
   * Handle incoming tick data: normalize → state → detect → broadcast.
   */
  handleTickerData(data) {
    try {
      const normalized = normalizer.normalizeTick(data);
      if (!normalized) {
        logger.debug('Normalizer rejected tick', { keys: Object.keys(data || {}) });
        return;
      }

      this.tickCount++;
      this.lastTickTime = new Date().toISOString();
      this.lastTickSymbol = normalized.symbol;

      // Ingest the tick into symbol state manager
      symbolState.addTick(normalized);

      // Process tick for anomalies using simulated timestamp
      try {
        detectionEngine.processTick(normalized);
      } catch (detErr) {
        logger.error(`Detection engine error for ${normalized.symbol}`, { error: detErr.message });
      }

      // Broadcast price update to downstream Socket.IO clients
      eventBus.emit('price_update', normalized);

      logger.debug(`Ingested tick for ${normalized.symbol}`, { price: normalized.price, timestamp: normalized.TS });
    } catch (err) {
      logger.error('Fatal error in handleTickerData', { error: err.message, stack: err.stack });
    }
  }

  /**
   * Close feed connection.
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      logger.info('Disconnected socket client from Trackz Market Feed');
    }
  }
}

module.exports = new MarketFeedClient();
