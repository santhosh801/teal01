'use strict';

const SpikeStrategy = require('./strategies/spikeStrategy');
const MovingAverageStrategy = require('./strategies/movingAverageStrategy');

class StrategyFactory {
  static create(type, config) {
    switch (type) {
      case 'spike':
        return new SpikeStrategy(config);
      case 'movingAverage':
        return new MovingAverageStrategy(config);
      default:
        throw new Error(`Unknown strategy type: ${type}`);
    }
  }
}

module.exports = StrategyFactory;
