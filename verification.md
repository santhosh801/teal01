# Final Verification Checklist

This checklist defines the validation protocol used to certify that the TealVue platform is hardened and ready for production submission.

---

## 📋 Verification Checklist

### 1. Ingestion & Normalization
- [ ] Backend connects successfully to mock data feed (`connect` event logged).
- [ ] Backend normalizes incoming raw ticks to standard `{ symbol, price, TS }` format.
- [ ] No `Date.now()` or host system clock fallbacks are used inside strategies.
- [ ] Ring buffer boundaries are enforced (max 500 ticks) and do not overflow memory.

### 2. Detection Logic & Strategies
- [ ] Spike Strategy triggers on rapid changes (percent change >= 3% within 30 simulated seconds).
- [ ] Moving Average Strategy triggers on deviation from historical average (deviation >= 5% over 10 samples).
- [ ] Cooldown duration (60 simulated seconds) is strictly respected in simulated time.
- [ ] Dynamic strategy allocation works for unknown symbols (e.g. suffixes generated during load testing).
- [ ] All unit tests pass: `cd backend && npm test`.

### 3. API Security & Rate Limiting
- [ ] Public endpoint `/health` returns `UP` status without authentication.
- [ ] Secure endpoint `/api/alerts` returns `412` or `401 Unauthorized` when requested without the API key header.
- [ ] Secure endpoint `/api/alerts` returns alerts successfully when `x-api-key: tealvue-assignment-key` is included.
- [ ] Secure endpoint `/api/symbols` returns symbol status successfully when authenticated.
- [ ] Rate limiting triggers `429 Too Many Requests` when sending more than 100 requests per minute from a single IP.

### 4. Downstream WebSockets & Broadcasts
- [ ] Socket.IO server boots without errors and accepts downstream connections.
- [ ] Pushes the latest 10 alerts to the dashboard immediately upon socket handshakes.
- [ ] Forwarding of `price_update` and `new_alert` from Event Bus to client-side listener operates in real-time.

### 5. Frontend & CSS Visual Polish
- [ ] Header display status badge is color-coded: green (`Live`), orange/red (`Disconnected`/`Reconnecting`).
- [ ] Grid system handles responsive resizing across mobile, tablet, and desktop viewports.
- [ ] Live price cards render with correct BEM styling and flash transition colors:
  - Green (`symbol-card__price--up`) on upward ticks.
  - Red (`symbol-card__price--down`) on downward ticks.
- [ ] Cards display calculated change percent since page initialization.
- [ ] Chart widgets load and update incrementally without memory leaks or component stack traces.

### 6. Containerization & Production Build
- [ ] Multi-stage `backend/Dockerfile` builds successfully and produces a minimal runtime image.
- [ ] Multi-stage `frontend/Dockerfile` builds successfully with build-time environment arguments and serves files via Nginx.
- [ ] `docker-compose.yml` launches both containers in the same network and uses health checks to coordinate boot sequencing.
- [ ] Accessing `http://localhost:5173` loads the dashboard in Docker compose.

### 7. Simulation Suite & Metrics
- [ ] Executing `node loadTest.js` spawns 1,000 virtual symbols.
- [ ] Run completes successfully and records E2E execution latency.
- [ ] Saves a JSON performance report to `loadtest_report.json`.

---

## 🛠️ Verification Execution Guide

### Command 1: Run Unit Tests
```bash
cd backend
npm test
```

### Command 2: Query Public Health Check
```bash
curl -i http://localhost:4000/health
```

### Command 3: Query Secure Endpoint (Unauthenticated)
```bash
curl -i http://localhost:4000/api/alerts
```
*Expected: `HTTP/1.1 401 Unauthorized`*

### Command 4: Query Secure Endpoint (Authenticated)
```bash
curl -i -H "x-api-key: tealvue-assignment-key" http://localhost:4000/api/alerts
```
*Expected: `HTTP/1.1 200 OK` with JSON array of alerts.*

### Command 5: Docker Compose Deploy
```bash
docker compose up --build -d
```
*Expected: Frontend accessible at http://localhost:5173, backend healthy on port 4000.*

### Command 6: Execute Load Test
```bash
# Set FEED_URL to point to the load test feed server, start backend in load test mode, then run loadTest.js.
node loadTest.js
```
