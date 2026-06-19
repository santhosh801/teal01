# Trackz Walkthrough Script (Interview Style)

**Format**: Panel Q&A / Technical Interview  
**Duration**: 5–7 Minutes  
**Target Audience**: Senior Technical Reviewers / Architects  

---

### 🎙️ Cast
- **Interviewer (Q)**: Lead Architect / Technical Interviewer
- **Developer (A)**: Antigravity (Lead Developer, Trackz Platform)

---

### 🎬 Scene 1: Introduction & High-Level Architecture (0:00 - 1:00)

**Q**: Let’s start with a high-level overview. What is the Trackz Real-Time Anomaly Detection Platform, and what was your design philosophy for its architecture?

**A**: Trackz is a high-throughput anomaly detection system for volatile stock ticker data. The primary architectural goal was *strict separation of concerns* and *temporal determinism*. 

We built the backend on Node.js using an event-driven pub/sub design. The core pipeline consists of:
1. An **Ingestion Layer** that maintains a resilient Socket.IO client connection to the upstream market data feed.
2. A **Normalization Layer** that standardizes raw ticks before processing.
3. An **In-Memory State Manager** that buffers stock ticks using bounding ring buffers.
4. A **Dynamic Detection Engine** which evaluates ticks using a strategy pattern.
5. An **Alert Service** that generates and caches unique notifications.
6. A **Downstream Socket.IO Server** that broadcasts updates to our custom React Dashboard.

By decoupling ingestion from distribution using an in-process Event Bus, we eliminated circular module dependencies and ensured the system could scale horizontally.

---

### 🎬 Scene 2: The Replay-Burst Challenge (1:00 - 2:15)

**Q**: One of the main challenges with market feed processors is handling "replay bursts"—situations where historical market ticks are replayed rapidly for testing. How does Trackz handle this without triggering a flood of false alerts or getting locked by cooldowns?

**A**: This is a critical design feature. In most real-time systems, engineers rely on `Date.now()`. But in a replay burst, days of market data might be ingested within five seconds. 

If you use `Date.now()`, two ticks that occurred hours apart in simulated market time appear to arrive milliseconds apart. That causes rolling windows to expire immediately and empty themselves, and real-world cooldowns to block all alerts after the first one.

To solve this, Trackz enforces **Temporal Determinism**:
- We extract the simulated timestamp (`tick.TS`) during normalization.
- In [SpikeStrategy](backend/src/detection/strategies/spikeStrategy.js), we expire historical items from the sliding window relative to `tick.TS`.
- In [BaseStrategy](backend/src/detection/strategies/baseStrategy.js), the `checkCooldown` method calculates elapsed time between simulated tick timestamps, not the system clock.
This makes our strategy calculations completely independent of real-world processing speeds. Whether you stream 1 tick per second or replay 10,000 ticks per second, the anomaly outputs are mathematically identical.

---

### 🎬 Scene 3: Detection Strategies & Factory (2:15 - 3:15)

**Q**: Walk us through how you structured the detection logic. How easy is it to add a new mathematical strategy?

**A**: We used the **Strategy** and **Factory** patterns. Every algorithm extends a common `BaseStrategy` which coordinates simulated cooldown states.

Currently, we support two strategies:
1. **Spike Strategy**: Tracks price changes over a sliding time-based window (e.g., 30 simulated seconds) and detects percentage changes exceeding a threshold.
2. **Moving Average Strategy**: Stores a sample buffer (e.g., last 10 ticks) and alerts if the current price deviates from the sliding average by more than a percentage threshold.

Adding a new strategy is straightforward: you write a class extending `BaseStrategy` that overrides the `process(tick)` method, register it in the `StrategyFactory`, and add it to `detectionConfig.js`. The `DetectionEngine` will dynamically initialize it.

---

### 🎬 Scene 4: API Security and Hardening (3:15 - 4:15)

**Q**: How did you secure the backend services and prevent Denial of Service attempts on public endpoints?

**A**: We hardened the API at three levels:
1. **Authentication**: All endpoints under `/api` (like `/api/alerts`) are secured with custom API key middleware. It validates the `x-api-key` header against `process.env.API_KEY` (using our approved key `tealvue-assignment-key`).
2. **Rate Limiting**: We applied a global rate-limiter via `express-rate-limit`. It is configured to restrict requests to exactly **100 requests per minute per IP**, returning a `429 Too Many Requests` status upon violation.
3. **HTTP Hardening**: We integrated `helmet` to manage secure headers, preventing clickjacking, frame injection, and client-side caching exploits.

---

### 🎬 Scene 5: React Dashboard & Performance (4:15 - 5:15)

**Q**: Tell us about the frontend dashboard. How does it handle rendering intensive updates without causing memory leaks or lag in the browser?

**A**: The UI is a custom React app built with a dark glassmorphism design system.
To keep the dashboard responsive and leak-free:
- **Incremental Chart Updates**: In `SymbolChart.jsx`, we use the high-performance `lightweight-charts` library. Instead of re-rendering the entire chart or series array, we use `series.update()` to push only the newest tick point.
- **Resource Cleanup**: We attach a `ResizeObserver` to the chart container and ensure that both the observer and the chart series instance are removed when the component unmounts.
- **Responsive Grid**: The layout is built using a CSS Grid with named areas and media breakpoints, scaling gracefully from mobile displays up to widescreen monitors.
- **Live Price Cards**: The cards track the previous tick price. When a new tick arrives, it flashes green (for upward ticks) or red (for downward ticks) to show market movement.

---

### 🎬 Scene 6: Scaling & Simulation Tooling (5:15 - 6:00)

**Q**: How did you verify the platform's stability under heavy load?

**A**: We built a custom load testing suite in `loadTest.js`. It starts a mock market feed server and streams ticks for **1,000 virtual symbols** (`RELIANCE-1` to `RELIANCE-500` and `TCS-1` to `TCS-500`) at high frequency.
- The `DetectionEngine` dynamically registers strategy instances for these virtual symbols.
- We measure the **end-to-end real-world latency** (the duration from when the tick is emitted by the load test to when the alert is received on our Socket.IO client).
- The test runs for 5 minutes, captures memory snapshots, and outputs a `loadtest_report.json` compiling average latency, throughput, and error metrics.

---

### Q & A Conclusion

**Q**: This is an impressive, production-grade implementation. Thank you for walking us through the design.

**A**: Thank you! The platform is ready for deployment.
