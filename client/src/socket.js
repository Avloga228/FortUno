import { io } from "socket.io-client";
import { API_URL } from './config';

// Unique flag to track if we've authenticated in the current session
let isAuthenticated = false;

// Create a single socket instance
export const socket = io(API_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  autoConnect: true,
  // Prevent multiple connections from the same client
  multiplex: true,
  // Force new connection when navigating between pages to prevent shared state issues
  forceNew: false,
  // Add query parameters for better debugging
  query: {
    clientType: 'web',
    version: '1.0.0'
  },
  // Додаємо налаштування для кращої підтримки WebSocket
  path: '/socket.io/',
  // Додаємо налаштування для автоматичного переключення транспорту
  upgrade: true,
  rememberUpgrade: true,
  // Додаємо налаштування для кращої обробки помилок
  rejectUnauthorized: false
});

// Track connection status
socket.on('connect', () => {
  console.log(`Socket connected with ID: ${socket.id}`);
  console.log(`Transport: ${socket.io.engine.transport.name}`);
  
  // Reset the authentication flag on new connection
  isAuthenticated = false;
  
  // Try to authenticate if we have a token
  const token = localStorage.getItem('authToken');
  if (token) {
    console.log('Authenticating on socket connection...');
    socket.emit('authenticate', token);
    isAuthenticated = true;
  }
});

// Track disconnections
socket.on('disconnect', (reason) => {
  console.log(`Socket disconnected. Reason: ${reason}`);
  // Reset authentication flag
  isAuthenticated = false;
});

// Custom authenticate method to prevent duplicate auth
socket.authenticateOnce = (token) => {
  if (!isAuthenticated && token) {
    console.log('Authenticating socket (custom method)...');
    socket.emit('authenticate', token);
    isAuthenticated = true;
    return true;
  } else if (isAuthenticated) {
    console.log('Socket already authenticated, skipping...');
  } else {
    console.log('No token available for authentication');
  }
  return false;
};

// Reconnect explicitly (useful after page navigation)
socket.reconnectExplicit = () => {
  console.log('Forcing socket reconnection...');
  if (!socket.connected) {
    socket.connect();
    return true;
  }
  return false;
};

// Handle connection errors
socket.on('connect_error', (error) => {
  console.error('Socket connection error:', error.message);
  // Attempt to reconnect after a delay
  setTimeout(() => {
    if (!socket.connected) {
      console.log('Attempting to reconnect...');
      socket.connect();
    }
  }, 5000);
});

// Handle reconnection attempts
socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`Attempting to reconnect (attempt ${attemptNumber})...`);
  // Try to upgrade to WebSocket if using polling
  if (socket.io.engine.transport.name === 'polling') {
    console.log('Attempting to upgrade to WebSocket...');
    socket.io.engine.upgrade();
  }
});

// Handle successful reconnection
socket.on('reconnect', (attemptNumber) => {
  console.log(`Successfully reconnected after ${attemptNumber} attempts`);
  console.log(`Transport: ${socket.io.engine.transport.name}`);
  // Re-authenticate after reconnection
  const token = localStorage.getItem('authToken');
  if (token) {
    socket.authenticateOnce(token);
  }
});

// Handle reconnection errors
socket.on('reconnect_error', (error) => {
  console.error('Reconnection error:', error.message);
});

// Handle reconnection failures
socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect after maximum attempts');
});

// Export single socket instance for reuse