'use strict';

const assert = require('assert');
const detectionEngine = require('./detectionEngine');
const alertService = require('../services/alertService');

console.log('Running Anomaly Detection Engine Unit Tests...\n');

// Helper to run a test block and report
function test(name, fn) {
  try {
    alertService.clear();
    detectionEngine.reset();
    fn();
    console.log(`✅ Passed: ${name}`);
  } catch (err) {
    console.error(`❌ Failed: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// Format date helper to simulate ISO strings with timezone: e.g. "2026-05-04 11:30:15+05:30"
function makeSimulatedTS(msOffset) {
  const baseTime = new Date("2026-05-04T11:30:00.000+05:30").getTime();
  const date = new Date(baseTime + msOffset);
  const yr = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dy = String(date.getDate()).padStart(2, '0');
  const hr = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const sc = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${yr}-${mo}-${dy} ${hr}:${mi}:${sc}.${ms}+05:30`;
}

// -------------------------------------------------------------
// Test Case 1: Normal Price Movement
// -------------------------------------------------------------
test('Normal Price Movement (No Anomalies)', () => {
  // Send normal ticks for RELIANCE (price changes < 3% over 30s)
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 100.0, TS: makeSimulatedTS(0) });
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 101.0, TS: makeSimulatedTS(10000) });
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 99.5, TS: makeSimulatedTS(20000) });
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 101.5, TS: makeSimulatedTS(30000) });

  // Send normal ticks for TCS (deviations < 5% from MA of 10 samples)
  for (let i = 0; i < 10; i++) {
    detectionEngine.processTick({
      SYMBOL: 'TCS',
      LTP: 200.0 + (i % 2 === 0 ? 1.0 : -1.0),
      TS: makeSimulatedTS(i * 5000)
    });
  }

  const alerts = alertService.getAlerts();
  assert.strictEqual(alerts.length, 0, 'No alerts should be generated for normal movements');
});

// -------------------------------------------------------------
// Test Case 2: Spike Detection
// -------------------------------------------------------------
test('Spike Detection (RELIANCE)', () => {
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 100.0, TS: makeSimulatedTS(0) });
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 101.0, TS: makeSimulatedTS(10000) });

  // Price jumps to 104.0 (+4%) within 20s (which is <= 30s windowSec)
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 104.0, TS: makeSimulatedTS(20000) });

  const alerts = alertService.getAlerts();
  assert.strictEqual(alerts.length, 1, 'Should generate exactly 1 spike alert');
  assert.strictEqual(alerts[0].symbol, 'RELIANCE');
  assert.strictEqual(alerts[0].type, 'SPIKE');
  assert.ok(alerts[0].description.includes('increased 4.0%'), `Description issue: ${alerts[0].description}`);
  
  const expectedTimestamp = new Date(makeSimulatedTS(20000)).getTime();
  assert.strictEqual(alerts[0].timestamp, expectedTimestamp, 'Alert timestamp must match simulated tick.TS in epoch ms');
});

// -------------------------------------------------------------
// Test Case 3: Price Drop Detection
// -------------------------------------------------------------
test('Price Drop Detection (RELIANCE)', () => {
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 100.0, TS: makeSimulatedTS(0) });
  // Price drops to 96.0 (-4%) within 20s (which is <= 30s windowSec)
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 96.0, TS: makeSimulatedTS(20000) });

  const alerts = alertService.getAlerts();
  assert.strictEqual(alerts.length, 1, 'Should generate exactly 1 drop alert');
  assert.strictEqual(alerts[0].symbol, 'RELIANCE');
  assert.strictEqual(alerts[0].type, 'SPIKE');
  assert.ok(alerts[0].description.includes('decreased 4.0%'), `Description issue: ${alerts[0].description}`);
});

// -------------------------------------------------------------
// Test Case 4: Moving Average Deviation Strategy Detection
// -------------------------------------------------------------
test('Moving Average Deviation Detection (TCS)', () => {
  // Establish a moving average of around 100.0 with 9 samples
  for (let i = 0; i < 9; i++) {
    detectionEngine.processTick({ SYMBOL: 'TCS', LTP: 100.0, TS: makeSimulatedTS(i * 1000) });
  }

  // Moving average of last 9 samples is 100.0
  // 10th sample jumps to 107.0. Current sample set will be [100*9, 107], MA = 100.7.
  // Deviation: ((107 - 100.7) / 100.7) * 100 = 6.25% deviation (exceeds 5%)
  detectionEngine.processTick({ SYMBOL: 'TCS', LTP: 107.0, TS: makeSimulatedTS(9000) });

  const alerts = alertService.getAlerts();
  assert.strictEqual(alerts.length, 1, 'Should generate exactly 1 MA deviation alert');
  assert.strictEqual(alerts[0].symbol, 'TCS');
  assert.strictEqual(alerts[0].type, 'MOVING_AVERAGE_DEVIATION');
  assert.ok(alerts[0].description.includes('deviated 6.3% above'), `Description issue: ${alerts[0].description}`);
});

// -------------------------------------------------------------
// Test Case 5: Cooldown / Deduplication
// -------------------------------------------------------------
test('Cooldown Enforcement in Simulated Time', () => {
  // 1st alert triggers at +20s
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 100.0, TS: makeSimulatedTS(0) });
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 104.0, TS: makeSimulatedTS(20000) });

  let alerts = alertService.getAlerts();
  assert.strictEqual(alerts.length, 1, 'First spike alert should fire');

  // Trigger another spike immediately at +21s (within 60s cooldown window)
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 108.0, TS: makeSimulatedTS(21000) });
  alerts = alertService.getAlerts();
  assert.strictEqual(alerts.length, 1, 'Spike alert should be suppressed by cooldown');

  // Advance simulated time past cooldown (> 60 seconds elapsed since last alert at baseTS + 20000)
  // Let's send a base tick at +85s (new window starts) and then a spike tick at +95s
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 100.0, TS: makeSimulatedTS(85000) });
  detectionEngine.processTick({ SYMBOL: 'RELIANCE', LTP: 104.0, TS: makeSimulatedTS(95000) });

  alerts = alertService.getAlerts();
  assert.strictEqual(alerts.length, 2, 'New spike alert should fire after cooldown has elapsed');
});

// -------------------------------------------------------------
// Test Case 6: Replay Burst False Positive Prevention
// -------------------------------------------------------------
test('Replay Burst Handling (Does not generate false positives due to time elapsed)', () => {
  // In a replay burst, data points arrive extremely fast in real time, but their TS advances normally.
  // We feed 50 ticks of TCS. The price remains exactly 100.0 or fluctuates slightly (<1% deviation).
  // Even if they all arrive at the exact same physical/clock time, they shouldn't trigger anomalies.
  for (let i = 0; i < 50; i++) {
    detectionEngine.processTick({
      SYMBOL: 'TCS',
      LTP: 100.0 + (i % 2 === 0 ? 0.2 : -0.2), // negligible fluctuation
      TS: makeSimulatedTS(i * 1000) // simulated time increments by 1s per tick
    });
  }

  // Also feed RELIANCE ticks with slow incremental price change.
  // Window is 30s. If we increase price by 0.1% every 10 simulated seconds, it should never exceed 3% spike threshold in any 30s window.
  for (let i = 0; i < 100; i++) {
    const price = 100.0 + (i * 0.1);
    detectionEngine.processTick({
      SYMBOL: 'RELIANCE',
      LTP: price,
      TS: makeSimulatedTS(i * 10000)
    });
  }

  const alerts = alertService.getAlerts();
  assert.strictEqual(alerts.length, 0, 'Replay burst of normal trend must trigger zero alerts');
});

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
process.exit(0);
