// API URL configuration
const isDevelopment = import.meta.env.DEV; // Vite надає цю змінну

// Використовуємо змінну середовища Vercel, якщо вона доступна (для продакшену),
// інакше використовуємо локальний URL (для розробки)
export const API_URL = import.meta.env.VITE_API_URL_PROD || 'http://localhost:5000';

console.log('Current environment (Vite DEV):', isDevelopment);
console.log('API URL:', API_URL);

// Game configuration
export const GAME_CONFIG = {
  minPlayers: 2,
  maxPlayers: 4,
  initialCards: 7,
  maxMessageLength: 200,
  reconnectionTimeout: 5000,
  gameStartDelay: 3000, // Delay in ms before starting game after min players joined
  turnTimeout: 60000, // Time in ms for a player's turn
  fortunoTimeout: 5000, // Time in ms to click FORTUNO button
  // Socket.IO client configuration options
  socketConfig: {
    transports: ['polling', 'websocket'],
    upgrade: true,
    rememberUpgrade: true,
    path: '/socket.io/',
    reconnectionDelayMax: 10000, // Maximum delay between reconnection attempts
    timeout: 20000, // Connection timeout before assuming connection failed
    // В інших місцях також додамо rejectUnauthorized: false при необхідності
  }
}; 