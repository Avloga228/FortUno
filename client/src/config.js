// API URL configuration
const isDevelopment = process.env.NODE_ENV === 'development';
export const API_URL = isDevelopment 
  ? 'http://localhost:5000'
  : 'https://fortuno-server.onrender.com';

// Game configuration
export const GAME_CONFIG = {
  minPlayers: 2,
  maxPlayers: 4,
  initialCards: 7,
  maxMessageLength: 200,
  reconnectionTimeout: 30000,
  gameStartDelay: 3000,
  turnTimeout: 30000,
  fortunoTimeout: 10000,
  socketConfig: {
    transports: ['websocket', 'polling'],
    upgrade: true,
    rememberUpgrade: true,
    path: '/socket.io/'
  }
}; 