'use strict';

const EventEmitter = require('events');

/**
 * Global in-process event bus.
 * Decouples the market feed client from the Socket.IO server
 * without creating circular dependencies.
 */
const eventBus = new EventEmitter();
eventBus.setMaxListeners(20);

module.exports = eventBus;
