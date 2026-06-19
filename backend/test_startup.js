// Minimal startup test — captures the exact crash error
console.log('[TEST] Starting startup test...');

try {
  console.log('[TEST] Loading config...');
  const config = require('./src/config');
  console.log('[TEST] Config loaded. Port:', config.server.port, 'Feed URL:', config.feed.url);

  console.log('[TEST] Loading app...');
  const app = require('./src/app');
  console.log('[TEST] App loaded OK');

  console.log('[TEST] Loading marketFeedClient...');
  const marketFeedClient = require('./src/services/marketFeedClient');
  console.log('[TEST] MarketFeedClient loaded OK');

  console.log('[TEST] Loading server module...');
  // Don't actually require server.js as it starts listening — just verify imports work
  const http = require('http');
  const { Server } = require('socket.io');
  const server = http.createServer(app);
  
  console.log('[TEST] Attempting to listen on port', config.server.port, '...');
  server.listen(config.server.port, () => {
    console.log('[TEST] ✅ Server listening on port', config.server.port);
    console.log('[TEST] Testing marketFeedClient.connect()...');
    try {
      marketFeedClient.connect();
      console.log('[TEST] ✅ marketFeedClient.connect() succeeded');
    } catch (err) {
      console.error('[TEST] ❌ marketFeedClient.connect() FAILED:', err.message);
    }
    
    // Keep running for 10 seconds to see if ticks arrive
    setTimeout(() => {
      console.log('[TEST] Feed status:', JSON.stringify(marketFeedClient.getStatus(), null, 2));
      console.log('[TEST] Done. Exiting.');
      process.exit(0);
    }, 10000);
  });

  server.on('error', (err) => {
    console.error('[TEST] ❌ Server listen FAILED:', err.message);
    if (err.code === 'EADDRINUSE') {
      console.error('[TEST] Port', config.server.port, 'is already in use! Kill the other process first.');
    }
    process.exit(1);
  });

} catch (err) {
  console.error('[TEST] ❌ CRASH during startup:', err.message);
  console.error('[TEST] Stack:', err.stack);
  process.exit(1);
}
