const { io } = require('socket.io-client');

console.log('=== TealVue Standalone Feed Test ===');
console.log('socket.io-client version:', require('socket.io-client/package.json').version);

const socket = io('https://mock-data.tealvue.in', {
  reconnection: false,
  transports: ['websocket', 'polling'],
});

socket.onAny((event, ...args) => {
  console.log(`[onAny] EVENT: "${event}"`, JSON.stringify(args).substring(0, 300));
});

socket.on('connect', () => {
  console.log('[connect] CONNECTED, id:', socket.id, 'transport:', socket.io.engine.transport.name);
  
  // Test: emit subscribe with array
  const payload = ['RELIANCE', 'TCS'];
  console.log('[subscribe] Emitting subscribe with payload:', JSON.stringify(payload));
  socket.emit('subscribe', payload);
});

socket.on('connect_error', (err) => {
  console.error('[connect_error]', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('[disconnect]', reason);
});

socket.on('error', (err) => {
  console.error('[error]', err);
});

socket.on('ticker', (data) => {
  console.log('[ticker] GOT TICKER DATA:', JSON.stringify(data).substring(0, 300));
});

// Also try catching other possible event names
socket.on('tick', (data) => {
  console.log('[tick] GOT TICK DATA:', JSON.stringify(data).substring(0, 300));
});

socket.on('data', (data) => {
  console.log('[data] GOT DATA:', JSON.stringify(data).substring(0, 300));
});

socket.on('message', (data) => {
  console.log('[message] GOT MESSAGE:', JSON.stringify(data).substring(0, 300));
});

let tickCount = 0;
const startTime = Date.now();

// Timeout after 15 seconds
setTimeout(() => {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== TIMEOUT after ${elapsed}s ===`);
  console.log(`Total ticker events received: ${tickCount}`);
  socket.disconnect();
  process.exit(0);
}, 15000);
