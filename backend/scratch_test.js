const { io } = require('socket.io-client');

const socket = io('https://mock-data.tealvue.in', {
  reconnection: false
});

let count = 0;

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('subscribe', ['RELIANCE', 'TCS']);
});

socket.on('ticker', (data) => {
  console.log(`Tick #${++count}:`, Object.keys(data), 'Sample data:', { SYMBOL: data.SYMBOL, LTP: data.LTP, price: data.price, CLOSE: data.CLOSE, TS: data.TS });
  if (count >= 10) {
    socket.disconnect();
    process.exit(0);
  }
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err);
  process.exit(1);
});

setTimeout(() => {
  console.log('Timeout');
  socket.disconnect();
  process.exit(0);
}, 10000);
