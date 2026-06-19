'use strict';

const { Server } = require('socket.io');
const { io } = require('socket.io-client');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Configuration
const TEST_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const NUM_VIRTUAL_STREAMS = 1000;
const TICK_INTERVAL_MS = 50; // Emit ticks every 50ms (globally)
const FEED_PORT = 4001;
const BACKEND_URL = 'http://localhost:4000';

console.log('==================================================');
console.log('TealVue Load Test Script');
console.log(`Duration: ${TEST_DURATION_MS / 1000 / 60} minutes`);
console.log(`Virtual Streams: ${NUM_VIRTUAL_STREAMS}`);
console.log('==================================================\n');

// Metrics structure
const metrics = {
  ticksSent: 0,
  alertsReceived: 0,
  latencies: [],
  errors: 0,
  startTime: null,
  endTime: null,
  memorySnapshots: []
};

// Map to track tick emission real times: "SYMBOL_SIMULATED_TS" -> emitRealTimeMs
const emitTimes = new Map();

// Generate virtual symbols list
const symbols = [];
for (let i = 1; i <= NUM_VIRTUAL_STREAMS / 2; i++) {
  symbols.push({ symbol: `RELIANCE-${i}`, type: 'spike', index: 0, basePrice: 100 });
  symbols.push({ symbol: `TCS-${i}`, type: 'ma', index: 0, basePrice: 200 });
}

// 1. Start Mock Market Feed Server (Socket.IO)
const httpServer = http.createServer();
const feedServer = new Server(httpServer, {
  cors: { origin: '*' }
});

let feedSocket = null;
feedServer.on('connection', (socket) => {
  console.log(`[Feed Server] Backend connected: ${socket.id}`);
  feedSocket = socket;
  
  socket.on('subscribe', (symbol) => {
    // Backend subscribes
  });

  socket.on('disconnect', () => {
    console.log('[Feed Server] Backend disconnected');
    feedSocket = null;
  });
});

httpServer.listen(FEED_PORT, () => {
  console.log(`[Feed Server] Running on port ${FEED_PORT}`);
});

// 2. Connect client to Backend to listen for alerts
console.log(`[Test Client] Connecting to backend at ${BACKEND_URL}...`);
const clientSocket = io(BACKEND_URL, {
  reconnection: true,
  reconnectionAttempts: 10
});

clientSocket.on('connect', () => {
  console.log(`[Test Client] Connected to backend: ${clientSocket.id}`);
});

clientSocket.on('new_alert', (alert) => {
  if (alert.type === 'BOOTSTRAP') return; // Ignore initial boot alert
  
  metrics.alertsReceived++;
  const key = `${alert.symbol}_${alert.timestamp}`;
  const sentTime = emitTimes.get(key);
  
  if (sentTime) {
    const latency = Date.now() - sentTime;
    metrics.latencies.push(latency);
    emitTimes.delete(key);
  }
});

clientSocket.on('connect_error', (err) => {
  metrics.errors++;
  console.error(`[Test Client] Connection error: ${err.message}`);
});

// 3. Main Load Test Execution
let tickIntervalId = null;
let memoryIntervalId = null;
let simulatedTime = Date.now();

function startTest() {
  metrics.startTime = Date.now();
  console.log('\n>>> Starting Load Test Execution...');

  // Track memory usage every 10 seconds
  memoryIntervalId = setInterval(() => {
    const mem = process.memoryUsage();
    metrics.memorySnapshots.push({
      elapsedMs: Date.now() - metrics.startTime,
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
      rssMb: Math.round(mem.rss / 1024 / 1024 * 100) / 100
    });
  }, 10000);

  let symbolCursor = 0;

  tickIntervalId = setInterval(() => {
    if (!feedSocket) return; // Wait until backend is connected

    // Emit 10 ticks per interval block to speed up throughput
    for (let batch = 0; batch < 10; batch++) {
      const symInfo = symbols[symbolCursor];
      symbolCursor = (symbolCursor + 1) % symbols.length;

      // Progress simulated time slightly for each tick
      simulatedTime += 1000; // +1 simulated second per tick

      let price = symInfo.basePrice;
      symInfo.index++;

      if (symInfo.type === 'spike') {
        // Trigger a spike alert every 60 ticks (to respect cooldown)
        if (symInfo.index % 60 === 0) {
          price = symInfo.basePrice * 1.04; // +4% spike
        } else {
          // Normal fluctuation
          price = symInfo.basePrice * (1 + (Math.sin(symInfo.index) * 0.005));
        }
      } else {
        // Trigger a Moving Average Deviation every 60 ticks
        if (symInfo.index % 60 === 0) {
          price = symInfo.basePrice * 1.07; // +7% deviation
        } else {
          price = symInfo.basePrice * (1 + (Math.cos(symInfo.index) * 0.005));
        }
      }

      const tickData = {
        SYMBOL: symInfo.symbol,
        LTP: Number(price.toFixed(2)),
        TS: new Date(simulatedTime).toISOString()
      };

      const key = `${symInfo.symbol}_${new Date(simulatedTime).getTime()}`;
      emitTimes.set(key, Date.now());

      feedSocket.emit('ticker', tickData);
      metrics.ticksSent++;
    }
  }, TICK_INTERVAL_MS);

  // Stop test after duration
  setTimeout(endTest, TEST_DURATION_MS);
}

function endTest() {
  metrics.endTime = Date.now();
  clearInterval(tickIntervalId);
  clearInterval(memoryIntervalId);

  console.log('\n>>> Load Test Completed. Compiling metrics...');

  // Close connections
  clientSocket.disconnect();
  feedServer.close();
  httpServer.close();

  // Calculations
  const durationSec = (metrics.endTime - metrics.startTime) / 1000;
  const avgThroughput = metrics.ticksSent / durationSec;
  
  let avgLatency = 0;
  let maxLatency = 0;
  let minLatency = 999999;
  
  if (metrics.latencies.length > 0) {
    const sum = metrics.latencies.reduce((acc, val) => acc + val, 0);
    avgLatency = sum / metrics.latencies.length;
    maxLatency = Math.max(...metrics.latencies);
    minLatency = Math.min(...metrics.latencies);
  } else {
    minLatency = 0;
  }

  // Find max memory usage
  const maxHeap = metrics.memorySnapshots.reduce((max, snap) => Math.max(max, snap.heapUsedMb), 0);

  const report = {
    testConfiguration: {
      durationSeconds: TEST_DURATION_MS / 1000,
      virtualSymbols: NUM_VIRTUAL_STREAMS,
      tickRateHz: 1000 / TICK_INTERVAL_MS * 10
    },
    results: {
      totalTicksSent: metrics.ticksSent,
      totalAlertsReceived: metrics.alertsReceived,
      ticksPerSecond: Number(avgThroughput.toFixed(2)),
      latencyMs: {
        avg: Number(avgLatency.toFixed(2)),
        min: Number(minLatency.toFixed(2)),
        max: Number(maxLatency.toFixed(2))
      },
      maxHeapUsedMb: maxHeap,
      networkErrors: metrics.errors
    },
    snapshots: metrics.memorySnapshots
  };

  // Output report
  console.log('\n==================================================');
  console.log('LOAD TEST SUMMARY REPORT');
  console.log('==================================================');
  console.log(`Ticks Sent:            ${report.results.totalTicksSent}`);
  console.log(`Alerts Received:       ${report.results.totalAlertsReceived}`);
  console.log(`Average Throughput:    ${report.results.ticksPerSecond} ticks/sec`);
  console.log(`Avg Latency (E2E):     ${report.results.latencyMs.avg} ms`);
  console.log(`Min Latency (E2E):     ${report.results.latencyMs.min} ms`);
  console.log(`Max Latency (E2E):     ${report.results.latencyMs.max} ms`);
  console.log(`Max Heap Used:         ${report.results.maxHeapUsedMb} MB`);
  console.log(`Network Errors:        ${report.results.networkErrors}`);
  console.log('==================================================\n');

  // Save report to file
  const reportPath = path.join(__dirname, 'loadtest_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Report written to: ${reportPath}`);

  process.exit(0);
}

// Start test after a small delay to allow sockets to boot
setTimeout(startTest, 2000);
