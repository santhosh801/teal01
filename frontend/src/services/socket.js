import { io } from 'socket.io-client';

// Use same-origin connection (Vite proxies /socket.io to backend).
// In production (Docker/Nginx), VITE_SOCKET_URL can point to the backend directly.
const BACKEND_URL = import.meta.env.VITE_SOCKET_URL || null;

let socket = null;
const listeners = new Map();

export function getSocket() {
  if (!socket) {
    const socketOpts = {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    };

    // When BACKEND_URL is set, connect directly to that URL.
    // When null, call io(opts) with NO url arg so Socket.IO defaults to same origin.
    socket = BACKEND_URL ? io(BACKEND_URL, socketOpts) : io(socketOpts);

    socket.on('connect', () => {
      console.log('[Socket] Connected to Trackz backend:', socket.id);
      emit('connection_status', { connected: true });
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
      emit('connection_status', { connected: false, reason });
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      emit('connection_status', { connected: false, error: err.message });
    });

    // Forward backend events to all registered listeners
    ['price_update', 'new_alert', 'initial_alerts'].forEach((event) => {
      socket.on(event, (data) => emit(event, data));
    });
  }
  return socket;
}

/** Register a listener for a named event. Returns an unsubscribe function. */
export function subscribe(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);

  // If subscribing to connection_status, immediately fire with current state
  // so components that mount after the socket connects get the right status.
  if (event === 'connection_status' && socket) {
    callback({ connected: socket.connected });
  }

  return () => listeners.get(event)?.delete(callback);
}

/** Check if the socket is currently connected. */
export function isConnected() {
  return socket?.connected ?? false;
}

function emit(event, data) {
  listeners.get(event)?.forEach((cb) => cb(data));
}

// Initialise on module load
getSocket();
