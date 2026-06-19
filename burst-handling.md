# Replay-Burst Handling Architecture

This document details how the TealVue platform handles high-density historical data replays (replay-bursts) without generating false alerts or triggering cooldown locks.

---

## ⚠️ The Replay-Burst Challenge

In standard real-time trading applications, events are processed as they occur, and calculations rely on real-world system time (e.g., `Date.now()`). However, during system testing or historical back-testing, data feeds are often replayed. 

During a **historical replay**:
- Months or days of trade ticks are "burst-broadcasted" in a few seconds or milliseconds.
- Ticks might arrive at a rate of 1,000+ per second.
- The interval between adjacent ticks in real-world time is a fraction of a millisecond, but the interval in *market-time* (historical simulated timestamps) might be seconds, minutes, or hours.

### Why Real-World Clock Architectures Fail

1. **Immediate Window Expiration**: If a detection algorithm checks a rolling window (e.g., "compare price against the oldest tick in a 30-second window") using `Date.now()`, any tick stored in the buffer will immediately be seen as expired. Ticks that occurred 1 simulated minute ago but arrived 2 milliseconds ago would be dropped from the queue, preventing any rolling comparison.
2. **Total Cooldown Lockout**: If an anomaly is detected, and a 60-second cooldown is enforced using `Date.now()`, only one alert will be allowed per real-world minute. In a replay burst, 1 real-world minute contains thousands of simulated market ticks representing hours of trading. Only the first alert would fire, and all subsequent anomalies over the next simulated hours would be ignored.

---

## 💡 The TealVue Solution

TealVue achieves **replay-burst immunity** by ensuring that all time-sensitive calculations are driven strictly by the simulated timestamps embedded in the tick payload (`tick.TS` or `TS`), rather than the system clock (`Date.now()`).

### 1. Simulated Time Progression
Every strategy instance tracks the current simulated time based on the latest tick processed.
- In [BaseStrategy](backend/src/detection/strategies/baseStrategy.js):
  - `this.lastAlertTS` tracks the simulated time when the last alert was generated.

### 2. Simulated Cooldown Calculations
The cooldown condition evaluates simulated timestamps:
```javascript
  checkCooldown(currentTS) {
    if (this.lastAlertTS === 0) return true;
    const elapsedSec = (currentTS - this.lastAlertTS) / 1000;
    return elapsedSec >= this.cooldownSec;
  }
```
If a replay burst contains ticks spanning hours of market time within a single real-world second, the simulated difference `currentTS - this.lastAlertTS` progresses rapidly, letting the cooldown expire exactly when it should in simulated market time.

### 3. Simulated Window Expiry
In [SpikeStrategy](backend/src/detection/strategies/spikeStrategy.js), ticks are stored in a rolling queue. When a new tick arrives with simulated timestamp `currentTS`, the strategy removes expired ticks using a simulated limit:
```javascript
    // 1. Add current tick to window
    this.ticksWindow.push({ price, TS: currentTS });

    // 2. Remove expired entries (ticks older than currentTS - windowMs in simulated time)
    const expiryTime = currentTS - this.windowMs;
    while (this.ticksWindow.length > 0 && this.ticksWindow[0].TS < expiryTime) {
      this.ticksWindow.shift();
    }
```
This guarantees that the rolling window always contains exactly the ticks that occurred within the configured simulated time frame (e.g., the last 30 simulated seconds), regardless of how fast the server ingests them.

---

## 🔍 Code Walkthrough & Reference Links

### Ingestion Entry Point
In [marketFeedClient.js](backend/src/services/marketFeedClient.js):
The incoming tick is normalized, capturing the simulated market timestamp `TS`. This standardized `TS` is used downstream:
```javascript
    const normalized = normalizer.normalizeTick(data);
    // ...
    symbolState.addTick(normalized);
    detectionEngine.processTick(normalized);
```

### State Storage
In [symbolState.js](backend/src/state/symbolState.js):
Ticks are saved with a parsed milliseconds timestamp derived from `tick.TS`, eliminating any fallback to `Date.now()` when the simulated timestamp is present:
```javascript
    const timestamp = new Date(rawTS).getTime();
```

### Detection Engine Synchronization
In [detectionEngine.js](backend/src/detection/detectionEngine.js):
The engine resolves the simulated time for strategy execution and enforces it when registering generated alerts:
```javascript
        alertService.createAlert({
          // ...
          timestamp: new Date(rawTS).getTime(), // Ensured alert matches simulated market time
          details: alertPayload.details
        });
```

---

## 📈 Verification under Load

During the [loadTest.js](loadTest.js) simulation:
- 1,000 virtual symbols stream price ticks.
- The simulated time increments by **1 simulated second per tick**.
- Ticks are sent in batches of 10 every 50ms (equivalent to 200 ticks/sec or 200 simulated seconds/sec).
- Under this burst of simulated time progression, the backend accurately triggers spike alerts and respects simulated cooldown timers. If the backend had used real-world clocks, the cooldown would have blocked almost all alerts, and the rolling windows would have remained empty. The load test confirms that alerts are triggered precisely when simulated limits are crossed.
