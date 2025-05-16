import { io } from "socket.io-client";

// Unique flag to track if we've authenticated in the current session
let isAuthenticated = false;

// Create a single socket instance
export const socket = io('http://localhost:5000', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  autoConnect: true,
  // Prevent multiple connections from the same client
  multiplex: true,
  // Force new connection when navigating between pages to prevent shared state issues
  forceNew: false
});

// Track connection status
socket.on('connect', () => {
  console.log(`Socket connected with ID: ${socket.id}`);
  
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
});

// Export single socket instance for reuse