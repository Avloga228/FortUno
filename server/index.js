const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateDeck, shuffleDeck, dealCards } = require('../shared/gameLogic');
const gameStates = {};

// Завантажуємо змінні середовища
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Підключення до MongoDB Atlas
mongoose.connect(process.env.MONGO_URL, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
  .then(() => console.log('MongoDB Atlas підключено'))
  .catch(err => console.error('Помилка підключення до MongoDB Atlas:', err));

// Схема користувача
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Схема кімнати зі зв'язком із користувачами
const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  players: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  gameStarted: { type: Boolean, default: false }
});

const Room = mongoose.model('Room', roomSchema);

// Helper function to save a document with retries for version conflicts
async function saveWithRetry(document, maxRetries = 3) {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await document.save();
      return true;
    } catch (err) {
      if (err.name === 'VersionError' && retries < maxRetries - 1) {
        console.log(`VersionError, спроба ${retries + 1} з ${maxRetries}`);
        
        // Reload the document to get the latest version
        const refreshDoc = await document.constructor.findById(document._id);
        if (!refreshDoc) {
          console.log('Документ більше не існує');
          return false;
        }
        
        // Copy the modified fields from our document to the refreshed one
        Object.keys(document.modified).forEach(path => {
          if (path !== '_id' && path !== '__v') {
            refreshDoc.set(path, document.get(path));
          }
        });
        
        // Replace our document with the refreshed one
        document = refreshDoc;
        retries++;
      } else {
        // Different error or max retries reached
        console.error('Помилка збереження документа:', err);
        return false;
      }
    }
  }
  
  return false;
}

// JWT Secret
const JWT_SECRET = 'fortuno-secret-key';

// Middleware для перевірки JWT токена
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Необхідна авторизація' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Користувач не знайдений' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недійсний токен авторизації' });
  }
};

// Реєстрація нового користувача
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Перевірка наявності всіх полів
    if (!username || !password) {
      return res.status(400).json({ error: 'Всі поля повинні бути заповнені' });
    }

    // Перевірка, чи існує вже користувач з таким username
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Користувач з таким нікнеймом вже існує' });
    }

    // Хешування пароля
    const hashedPassword = await bcrypt.hash(password, 10);

    // Створення нового користувача
    const user = new User({
      username,
      password: hashedPassword
    });

    await user.save();

    // Генерація JWT токена
    const token = jwt.sign({ 
      userId: user._id,
      username: user.username 
    }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Користувач успішно зареєстрований',
      token,
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (err) {
    console.error('Помилка реєстрації:', err);
    res.status(500).json({ error: 'Помилка реєстрації користувача' });
  }
});

// Вхід користувача
app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Перевірка наявності всіх полів
    if (!username || !password) {
      return res.status(400).json({ error: 'Всі поля повинні бути заповнені' });
    }

    // Пошук користувача за username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Неправильний нікнейм або пароль' });
    }

    // Перевірка пароля
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Неправильний нікнейм або пароль' });
    }

    // Генерація JWT токена
    const token = jwt.sign({ 
      userId: user._id,
      username: user.username 
    }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Вхід успішний',
      token,
      user: {
        id: user._id,
        username: user.username
      }
    });
  } catch (err) {
    console.error('Помилка входу:', err);
    res.status(500).json({ error: 'Помилка входу' });
  }
});

// Перевірка авторизації (для клієнта)
app.get('/api/users/me', authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username
    }
  });
});

// Ендпоінт для створення кімнати (захищений авторизацією)
app.post('/api/rooms', authenticate, async (req, res) => {
  try {
    const roomId = Math.random().toString(36).substring(2, 8);
    const room = new Room({ 
      roomId, 
      players: [req.user.username] 
    });
    await room.save();
    console.log(`🏠 Кімната створена: ${roomId}, гравець: ${req.user.username}`);
    res.json({ roomId });
  } catch (err) {
    console.error('Помилка створення кімнати:', err);
    res.status(500).json({ error: 'Помилка створення кімнати' });
  }
});

// Ендпоінт для перевірки існування кімнати
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (room) {
      res.json({ 
        exists: true, 
        gameStarted: room.gameStarted,
        players: room.players
      });
    } else {
      res.json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ error: 'Помилка перевірки кімнати' });
  }
});

// Ендпоінт для отримання всіх активних кімнат
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await Room.find({}).sort({ createdAt: -1 });
    
    // Filter out rooms with zero players
    const validRooms = rooms.filter(room => {
      // Remove duplicate players if any
      const uniquePlayers = [...new Set(room.players)];
      
      if (uniquePlayers.length !== room.players.length) {
        // If we found duplicates, save the cleaned player list
        console.log(`Cleaning duplicates in room ${room.roomId} player list`);
        // This will be saved but doesn't block the response
        Room.updateOne(
          { roomId: room.roomId }, 
          { $set: { players: uniquePlayers } }
        ).catch(err => console.error('Error updating room players:', err));
      }
      
      // Only include rooms with at least one player
      return uniquePlayers.length > 0;
    });
    
    // Process valid rooms to return to client
    const roomsWithPlayerCount = validRooms.map(room => {
      const uniquePlayers = [...new Set(room.players)];
      
      return {
        roomId: room.roomId,
        playerCount: uniquePlayers.length,
        players: uniquePlayers,
        gameStarted: room.gameStarted
      };
    });
    
    res.json({ rooms: roomsWithPlayerCount });
  } catch (err) {
    res.status(500).json({ error: 'Помилка отримання списку кімнат' });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://fortuno.vercel.app', 'https://fortuno-client.vercel.app']
      : 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Допоміжна функція для відправки оновленого стану гравців всім у кімнаті
async function emitPlayersState(roomId) {
  try {
    const state = gameStates[roomId];
    if (!state) return;
    
    // Get the current room data from the database to ensure we have the latest players list
    const room = await Room.findOne({ roomId });
    if (!room) return;
    
    // Use the database player list as the source of truth
    const players = room.players.map(username => ({
      id: username,
      name: username,
      handSize: state.hands[username] ? state.hands[username].length : 0
    }));
    
    io.to(roomId).emit('updatePlayers', { players });
  } catch (err) {
    console.error('Error in emitPlayersState:', err);
  }
}

// Add a global map to track completely disconnected players
const disconnectedPlayers = new Map(); // roomId -> Set of disconnected usernames

// Add chat-related data structures
const roomMessages = new Map(); // Store messages for each room temporarily
const typingUsers = new Map(); // Track typing status for each room

// Обробка Socket.IO подій
io.on('connection', (socket) => {
  console.log('Користувач підключився:', socket.id);
  
  // Встановлення автентифікації для сокета
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      // Зберігаємо інформацію про користувача у об'єкті сокета
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      console.log(`Користувач ${socket.username} автентифікований`);
    } catch (err) {
      console.error('Помилка автентифікації сокета:', err);
    }
  });

  // Приєднання до кімнати
  socket.on('joinRoom', async (roomId) => {
    try {
      // Skip if no username (authentication required)
      if (!socket.username) {
        socket.emit('authError', { message: 'Потрібна авторизація для приєднання до кімнати' });
        console.log(`❌ Спроба приєднатися до кімнати ${roomId} без автентифікації`);
        return;
      }
      
      console.log(`👋 Спроба приєднатися до кімнати ${roomId}, гравець: ${socket.username}, socket: ${socket.id}`);
      
      // Get all sockets in the room
      const socketsInRoom = await io.in(roomId).fetchSockets();
      
      // For active games, we should allow reconnection even if the player is already in the room
      let roomData = await Room.findOne({ roomId });
      if (!roomData) {
        console.log(`❌ Кімната ${roomId} не знайдена`);
        socket.emit('roomNotFound', { message: 'Кімната не існує' });
        return;
      }
      
      // For active games, allow reconnection even if player is already in the room
      if (!roomData.gameStarted) {
        // Only check for duplicate connections in waiting rooms
        const isAlreadyInRoom = socketsInRoom.some(s => 
          s.id !== socket.id && s.username === socket.username
        );
        
        if (isAlreadyInRoom) {
          console.log(`⚠️ Гравець ${socket.username} вже підключений до кімнати ${roomId} з іншого сокета`);
          // Don't add duplicate sockets
          socket.emit('actionBlocked', { message: 'Ви вже підключені до цієї кімнати в іншій вкладці' });
          return;
        }
      } else {
        console.log(`🎮 Гра вже розпочата, дозволяємо перепідключення для ${socket.username}`);
        
        // Remove player from disconnected players list when they reconnect
        if (disconnectedPlayers.has(roomId) && 
            disconnectedPlayers.get(roomId).has(socket.username)) {
          disconnectedPlayers.get(roomId).delete(socket.username);
          console.log(`👥 Гравець ${socket.username} перепідключився до кімнати ${roomId}`);
          console.log(`👥 Оновлений список відключених гравців: ${Array.from(disconnectedPlayers.get(roomId))}`);
        }
      }
      
      // roomData already retrieved earlier
      if (roomData) {
        console.log(`✅ Кімната ${roomId} знайдена`);
        
        // Check if game has already started and this is a new player trying to join
        if (roomData.gameStarted && !roomData.players.includes(socket.username)) {
          console.log(`⚠️ Гравець ${socket.username} намагається приєднатися до гри, яка вже розпочалася`);
          socket.emit('gameAlreadyStarted', { message: 'Гра вже розпочалася. Ви не можете приєднатися.' });
          return;
        }
        
        // Check if player limit is reached (max 4 players)
        if (roomData.players.length >= 4 && !roomData.players.includes(socket.username)) {
          socket.emit('actionBlocked', { message: 'Кімната заповнена' });
          return;
        }
        
        // Join the room
        socket.join(roomId);
        
        // Store roomId in socket object
        socket.roomId = roomId;
        
        // Properly handle player joining, removing duplicates if needed
        // Check if the player is already in the room
        const playerIndex = roomData.players.indexOf(socket.username);
        
        if (playerIndex === -1) {
          // Player is completely new to this room, add them
          roomData.players.push(socket.username);
          await roomData.save();
          console.log(`🎮 Гравець ${socket.username} приєднався до кімнати ${roomId}. Зараз гравців: ${roomData.players.length}`);
        } else {
          // Player is reconnecting - check for and remove any duplicates
          let hasDuplicates = false;
          // Create a unique player list
          const uniquePlayers = [...new Set(roomData.players)];
          
          if (uniquePlayers.length !== roomData.players.length) {
            console.log(`⚠️ Виявлено дублікати гравців. Очищаємо список...`);
            console.log(`Було: ${JSON.stringify(roomData.players)}`);
            roomData.players = uniquePlayers;
            try {
              await roomData.save();
              console.log(`Стало: ${JSON.stringify(roomData.players)}`);
            } catch (err) {
              if (err.name === 'VersionError') {
                console.log('Помилка версії документа при оновленні списку гравців, повторна спроба...');
                // Refetch the room and try again
                const refreshedRoom = await Room.findOne({ roomId });
                if (refreshedRoom) {
                  // Remove duplicates from the refreshed list
                  const refreshedUnique = [...new Set(refreshedRoom.players)];
                  if (!refreshedUnique.includes(socket.username)) {
                    refreshedUnique.push(socket.username);
                  }
                  refreshedRoom.players = refreshedUnique;
                  await refreshedRoom.save();
                  console.log(`Стало (після повторної спроби): ${JSON.stringify(refreshedRoom.players)}`);
                  roomData = refreshedRoom; // Update our reference
                }
              } else {
                console.error('Помилка оновлення списку гравців:', err);
              }
            }
            hasDuplicates = true;
          }
          
          if (!hasDuplicates) {
            console.log(`🔄 Гравець ${socket.username} перепідключився до кімнати ${roomId}`);
          }
        }
        
        // Clean up any duplicate players in the list before proceeding
        const uniquePlayers = [...new Set(roomData.players)];
        if (uniquePlayers.length !== roomData.players.length) {
          console.log(`⚠️ Виявлено дублікати гравців при приєднанні. Очищаємо список...`);
          console.log(`Було: ${JSON.stringify(roomData.players)}`);
          roomData.players = uniquePlayers;
          try {
            await roomData.save();
            console.log(`Стало: ${JSON.stringify(roomData.players)}`);
          } catch (err) {
            if (err.name === 'VersionError') {
              console.log('Помилка версії документа при оновленні списку гравців, повторна спроба...');
              // Refetch the room and try again
              const refreshedRoom = await Room.findOne({ roomId });
              if (refreshedRoom) {
                // Remove duplicates from the refreshed list
                const refreshedUnique = [...new Set(refreshedRoom.players)];
                if (!refreshedUnique.includes(socket.username)) {
                  refreshedUnique.push(socket.username);
                }
                refreshedRoom.players = refreshedUnique;
                await refreshedRoom.save();
                console.log(`Стало (після повторної спроби): ${JSON.stringify(refreshedRoom.players)}`);
                roomData = refreshedRoom; // Update our reference
              }
            } else {
              console.error('Помилка оновлення списку гравців:', err);
            }
          }
        }
        
        // Log current player list after joining
        console.log(`📋 Список гравців у кімнаті ${roomId}: ${JSON.stringify(roomData.players)}`);
        
        // Prepare player list to send to clients
        let playersList = roomData.players;
        const gameState = gameStates[roomId];
        
        if (gameState && gameState.hands) {
          playersList = roomData.players.map(player => ({
            id: player,
            name: player,
            handSize: gameState.hands[player] ? gameState.hands[player].length : 0
          }));
        }
        
        // Send player list to all room members
        io.to(roomId).emit('playerJoined', { players: playersList });
        
        // If game is already in progress, send game state to the reconnecting player
        if (roomData.gameStarted && gameState) {
          console.log(`🎲 Гравець ${socket.username} перепідключився до активної гри`);
          
          // Send the player their hand
          if (gameState.hands[socket.username]) {
            socket.emit('handDealt', {
              hand: gameState.hands[socket.username],
              discardTop: gameState.discardPile[gameState.discardPile.length - 1]
            });
          }
          
          // Send game started event to set the UI state
          socket.emit('gameStarted', {
            players: playersList,
            discardTop: gameState.discardPile[gameState.discardPile.length - 1]
          });
          
          // Send current player's turn
          const currentPlayerId = roomData.players[gameState.currentPlayerIndex];
          socket.emit('turnChanged', { currentPlayerId });
          
          console.log(`🎮 Відправлено інформацію про активну гру гравцю ${socket.username}`);
        }
      } else {
        console.log(`❌ Кімната ${roomId} не знайдена`);
        socket.emit('roomNotFound', { message: 'Кімната не існує' });
      }
    } catch (err) {
      console.error('Помилка приєднання до кімнати:', err);
    }
  });

  // Старт гри
  socket.on('startGame', async (roomId) => {
    console.log(`🎲 Початок гри в кімнаті ${roomId}, ініціатор: ${socket.username}`);
    
    try {
    const room = await Room.findOne({ roomId });
      if (!room) {
        console.log(`❌ Неможливо почати гру - кімната ${roomId} не знайдена`);
        return;
      }
      
      // Check if game is already started
      if (room.gameStarted) {
        console.log(`⚠️ Гра в кімнаті ${roomId} вже розпочата`);
        socket.emit('errorMessage', { message: "Гра вже розпочата!" });
        
        // Re-send game state to the player who tried to start again
        const gameState = gameStates[roomId];
        if (gameState) {
          // Send the player their hand
          if (gameState.hands[socket.username]) {
            socket.emit('handDealt', {
              hand: gameState.hands[socket.username],
              discardTop: gameState.discardPile[gameState.discardPile.length - 1]
            });
          }
          
          // Create player info list
          const playersList = room.players.map(player => ({
            id: player,
            name: player,
            handSize: gameState.hands[player] ? gameState.hands[player].length : 0
          }));
          
          // Re-send game state
          socket.emit('gameStarted', {
            players: playersList,
            discardTop: gameState.discardPile[gameState.discardPile.length - 1]
          });
          
          // Re-send current player's turn
          const currentPlayerId = room.players[gameState.currentPlayerIndex];
          socket.emit('turnChanged', { currentPlayerId });
        }
        return;
      }

      // ALWAYS check for and remove duplicate players
      const uniquePlayers = [...new Set(room.players)];
      if (uniquePlayers.length !== room.players.length) {
        console.log(`⚠️ Виявлено дублікати гравців. Очищаємо список...`);
        console.log(`Було: ${JSON.stringify(room.players)}`);
        room.players = uniquePlayers;
        await room.save();
        console.log(`Стало: ${JSON.stringify(room.players)}`);
        
        // Update the client with the new player list
        const updatedPlayersList = room.players.map(player => ({
          id: player,
          name: player,
          handSize: 0
        }));
        io.to(roomId).emit('playerJoined', { players: updatedPlayersList });
      }

      // Now check if we have enough players
    if (room.players.length < 2) {
      io.to(roomId).emit('errorMessage', { message: "Мінімум 2 гравці для старту гри!" });
        console.log(`⚠️ Неможливо почати гру - недостатньо гравців (${room.players.length})`);
      return;
    }

      // Log players in the room before starting
      console.log(`👥 Гравці в кімнаті ${roomId} перед початком гри: ${JSON.stringify(room.players)}`);

      // Get connected sockets in the room to verify
      const socketsInRoom = await io.in(roomId).fetchSockets();
      console.log(`🔌 Підключені сокети в кімнаті ${roomId}: ${socketsInRoom.length}`);
      console.log(socketsInRoom.map(s => `${s.username} (${s.id})`).join(', '));

      // Mark the room as having a started game
      room.gameStarted = true;
      await room.save();
      console.log(`🎲 Гра в кімнаті ${roomId} позначена як розпочата`);

      // We'll notify clients to redirect only after game state is fully prepared

    // Генеруємо та тасуємо колоду
    let deck = shuffleDeck(generateDeck());
    // Роздаємо картини гравцям
    const { hands, deck: newDeck } = dealCards(deck, room.players);

    // Вибираємо першу карту для скидання, що не є чорною або спеціальною
    let discardTopCard;
    let deckAfterFirst = [...newDeck]; // Створюємо копію колоди
    
    // Список спеціальних значень карт
    const specialValues = [
      "Пропуск ходу", 
      "Обертання ходу", 
      "+3 картини", 
      "+5 карт", 
      "ФортУно"
    ];
    
    // Вибираємо першу звичайну карту (не чорну і не спеціальну)
    do {
      // Перевіряємо чи є ще картини
      if (deckAfterFirst.length === 0) {
        // Якщо немає, переміщаємо всі картини з кінця назад
        console.warn("Не вдалося знайти звичайну карту, перемішуємо колоду");
        deckAfterFirst = shuffleDeck(deckAfterFirst);
        // Запобігаємо нескінченному циклу, якщо всі картини спеціальні
        if (deckAfterFirst.length > 0) {
          discardTopCard = deckAfterFirst.shift();
          break;
        }
      }
      
      discardTopCard = deckAfterFirst.shift(); // Беремо першу карту
      
      // Перевіряємо чи карта чорна або спеціальна
      const isBlackOrSpecial = 
        discardTopCard.color === "black" || 
        specialValues.includes(discardTopCard.value);
      
      // Якщо карта чорна або спеціальна, перекладаємо її в кінець колоди
      if (isBlackOrSpecial) {
        deckAfterFirst.push(discardTopCard);
      }
    } while (
      (discardTopCard.color === "black" || 
       specialValues.includes(discardTopCard.value)) && 
      deckAfterFirst.length > 0
    );
    
    console.log(`Перша карта: ${discardTopCard.color} ${discardTopCard.value}`);
    
    // Створюємо скид з першою картою
    const discardPile = [discardTopCard];

    // Зберігаємо стан гри у пам'яті
    gameStates[roomId] = {
      deck: deckAfterFirst,
      hands,
      discardPile,
      currentPlayerIndex: 0, // Починає перший гравець
      direction: 1 // 1 - за годинниковою, -1 - проти
    };

    // Відправляємо кожному гравцю його руку
      for (const username of room.players) {
        // Знаходимо сокет-ід гравця за його нікнеймом
        const playerSocketId = findSocketIdByUsername(username);
        if (playerSocketId) {
          io.to(playerSocketId).emit('handDealt', {
            hand: hands[username],
        discardTop: discardPile[0]
      });
    }
      }
      
      // Create player info objects with details for the UI
      const playerInfoList = room.players.map(username => ({
        id: username,
        name: username,
        handSize: hands[username] ? hands[username].length : 0
      }));
      
    // Оновлюємо стан столу для всіх
    io.to(roomId).emit('gameStarted', {
        players: playerInfoList,
      discardTop: discardPile[0]
    });
    
      // Send the first player's turn
      const firstPlayerUsername = room.players[0];
      console.log(`🎮 Перший хід: ${firstPlayerUsername}`);
      
    io.to(roomId).emit('turnChanged', {
        currentPlayerId: firstPlayerUsername
      });
      
      // Now that the game state is fully prepared, redirect clients to the game room
      console.log(`🔄 Підготовка перенаправлення до ігрової кімнати ${roomId}`);
      
      // More aggressive redirection strategy with multiple attempts
      const sendRedirects = (attempts = 1) => {
        // First verify that the room still exists
        Room.findOne({ roomId }).then(roomCheck => {
          if (roomCheck && roomCheck.gameStarted) {
            console.log(`🔄 Спроба #${attempts}: Відправляємо перенаправлення до ігрової кімнати ${roomId}`);
            
            // Send to all sockets in the room
            io.to(roomId).emit('redirectToGameRoom', { roomId });
            
            // Get all sockets to make sure they receive the redirect
            io.in(roomId).fetchSockets().then(sockets => {
              // Send individually to each socket as a backup
              sockets.forEach(s => {
                s.emit('redirectToGameRoom', { roomId });
              });
              
              console.log(`🔄 Відправлено індивідуальні редіректи для ${sockets.length} гравців`);
              
              // Schedule another attempt with increasing delay if we haven't reached max attempts
              if (attempts < 3) {
                setTimeout(() => sendRedirects(attempts + 1), attempts * 1000);
              }
            });
          } else {
            console.log(`⚠️ Кімната ${roomId} більше не існує або гра не розпочата, пропускаємо перенаправлення`);
          }
        }).catch(err => console.error('Помилка при перевірці кімнати перед перенаправленням:', err));
      };
      
      // Start sending redirects with a short initial delay
      setTimeout(() => sendRedirects(), 500);
    } catch (err) {
      console.error('Помилка при старті гри:', err);
    }
  });

  // Додаємо допоміжну функцію для визначення наступного гравця
  async function getNextPlayerIndex(state, roomId) {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) {
        console.warn(`⚠️ Не вдалося знайти кімнату ${roomId} для визначення наступного гравця`);
        return (state.currentPlayerIndex + state.direction + Object.keys(state.hands).length) % Object.keys(state.hands).length;
      }
      
      const n = room.players.length;
    return (state.currentPlayerIndex + state.direction + n) % n;
    } catch (err) {
      console.error('Помилка в getNextPlayerIndex:', err);
      return (state.currentPlayerIndex + state.direction + Object.keys(state.hands).length) % Object.keys(state.hands).length;
    }
  }

  // Викладання картини
  socket.on('playCard', async ({ roomId, card }) => {
    const state = gameStates[roomId];
    if (!state) return;
    
    // Переконуємося, що користувач автентифікований
    if (!socket.username) {
      socket.emit('authError', { message: 'Необхідна авторизація' });
      return;
    }
    
    try {
      // Get the room to access players list
      const room = await Room.findOne({ roomId });
      if (!room) {
        console.warn(`⚠️ Кімната ${roomId} не знайдена при спробі зіграти карту`);
        return;
      }
      
      // Use the room's players array to determine the current player
      const currentPlayerId = room.players[state.currentPlayerIndex];
      
      if (socket.username !== currentPlayerId) {
        console.log(`⚠️ Гравець ${socket.username} намагається походити не в свій хід`);
        socket.emit('actionBlocked', { message: 'Зараз не ваш хід' });
        return; // Не твій хід
      }
  
      // Перевірка: чи є карта у руці гравця
      const hand = state.hands[socket.username];
      const cardIndex = hand.findIndex(
        c => c.value === card.value && c.color === card.color
      );
      if (cardIndex === -1) return; // Немає такої картини
  
      // Перевірка правил (спрощено)
      const top = state.discardPile[state.discardPile.length - 1];
      let canPlay = false;

      if (top.color === "black" && top.chosenColor) {
        // Після чорної картини дозволяється класти лише обраний колір або чорну
        canPlay = (card.color === top.chosenColor) || (card.color === "black");
      } else {
        canPlay =
          card.color === top.color ||
          card.value === top.value ||
          card.color === "black" ||
          card.value === "ФортУно";
      }
      if (!canPlay) return; // Не можна викласти
  
      // Видаляємо карту з руки
      hand.splice(cardIndex, 1);

      // Перевіряємо чи це карта Фортуно
      if (card.value === "ФортУно" && card.chosenColor) {
        // Додаємо карту у скидання
        state.discardPile.push(card);
        
        // Блокуємо ходи інших гравців під час дії Фортуно
        state.fortunoPending = true;
        state.fortunoPlayerId = socket.username;
        
        // Виконуємо кидок кубика для Фортуно - гарантуємо рівні шанси
        const diceResult = Math.floor(Math.random() * 6) + 1;
        card.diceResult = diceResult;
        
        // Повідомляємо всіх про кидок кубика з однаковим результатом
        io.to(roomId).emit('fortunoDiceRolled', { 
          diceResult,
          playerId: socket.username
        });
        
        // Не застосовуємо ефект одразу, а зберігаємо його для застосування після анімації кубика
        state.pendingFortunoEffect = diceResult;
        
        // If this is the second-to-last card, delay the FORTUNO button
        if (hand.length === 1) {
          // Store that we need to show FORTUNO button after dice roll
          state.pendingFortunoButton = true;
        }
      } else {
        // Блокуємо хід, якщо очікується дія Фортуно
        if (state.fortunoPending && socket.username !== state.fortunoPlayerId) {
          // Повертаємо карту гравцю
          hand.push(card);
          // Повідомляємо гравця, що хід заблоковано
          io.to(socket.id).emit('actionBlocked', { message: 'Очікується завершення дії Фортуно' });
          return;
        }
        
        // Для всіх інших карт - звичайна логіка
        state.discardPile.push(card);
      
        // Якщо карта +3 або +5 — дати наступному гравцю відповідну кількість карт
        if (card.value === "+3 картини" || card.value === "+5 карт") {
          const count = card.value === "+3 картини" ? 3 : 5;
          const nextIndex = await getNextPlayerIndex(state, roomId);
          const nextPlayerId = room.players[nextIndex];
          for (let i = 0; i < count; i++) {
            if (state.deck.length > 0) {
              state.hands[nextPlayerId].push(state.deck.shift());
            }
          }
          // Знаходимо сокет-ід гравця за його нікнеймом
          const nextPlayerSocketId = findSocketIdByUsername(nextPlayerId);
          if (nextPlayerSocketId) {
            io.to(nextPlayerSocketId).emit('updateHandAndDiscard', {
              hand: state.hands[nextPlayerId],
              discardTop: card
            });
          }
          // Хід переходить до опонента (наступного гравця)
          state.currentPlayerIndex = nextIndex;
        } else if (card.value === "Пропуск ходу") {
          // Пропустити наступного гравця
          const n = room.players.length;
          state.currentPlayerIndex = (state.currentPlayerIndex + 2 * state.direction + n) % n;
        } else if (card.value === "Обертання ходу") {
          const n = room.players.length;
          if (n === 2) {
            // Для двох гравців — як пропуск ходу (гравець ходить ще раз)
            state.currentPlayerIndex = (state.currentPlayerIndex + 2 * state.direction + n) % n;
          } else {
            // Для 3+ гравців — змінюємо напрямок
            state.direction *= -1;
            // Після зміни напрямку хід переходить до наступного у новому напрямку
            state.currentPlayerIndex = (state.currentPlayerIndex + state.direction + n) % n;
          }
        } else {
          // Передати хід наступному
          state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
        }
      }

      // Check if player has only one card left after playing
      if (hand.length === 1 && !state.pendingFortunoButton) {
        // Start FORTUNO event
        state.fortunoState = {
          playerWithOneCard: socket.username,
          fortunoButtonVisible: true,
          fortunoButtonClickedBy: null,
          fortunoButtonTimeout: setTimeout(async () => {
            const state = gameStates[roomId];
            if (!state || !state.fortunoState) return;

            const playerToDrawCards = state.fortunoState.playerWithOneCard;
            
            // Add 2 cards to the player who didn't say FORTUNO
            const cardsToAdd = state.deck.slice(0, 2);
            state.deck = state.deck.slice(2);

            if (state.hands[playerToDrawCards]) {
              state.hands[playerToDrawCards].push(...cardsToAdd);
            }

            // Hide FORTUNO button
            io.to(roomId).emit('hideFortunoButton');

            // Notify all players
            io.to(roomId).emit('fortunoTimeout', {
              penalizedPlayer: playerToDrawCards,
              message: `${playerToDrawCards} не встиг сказати FORTUNO! +2 картини.`
            });

            // Update the penalized player's hand
            const penalizedSocket = findSocketIdByUsername(playerToDrawCards);
            if (penalizedSocket) {
              io.to(penalizedSocket).emit('updateHandAndDiscard', {
                hand: state.hands[playerToDrawCards],
                discardTop: state.discardPile[state.discardPile.length - 1]
              });
            }

            // Reset FORTUNO state
            state.fortunoState = {
              playerWithOneCard: null,
              fortunoButtonVisible: false,
              fortunoButtonClickedBy: null,
              fortunoButtonTimeout: null,
              fortunoSaid: false
            };

            // Update all players about the new hand sizes
            await emitPlayersState(roomId);
          }, 5000) // 5 seconds to say FORTUNO
        };
        
        // Show FORTUNO button to all players
        io.to(roomId).emit('showFortunoButton');
      }

      // Check for win condition
      if (hand.length === 0) {
        // Check if player said FORTUNO before winning
        if (state.fortunoState && 
            (state.fortunoState.fortunoButtonClickedBy === socket.username ||
             state.fortunoState.fortunoSaid)) {
          // Player wins!
          console.log(`🏆 Гравець ${socket.username} переміг у грі!`);
          
          // First notify all players about the win
          io.to(roomId).emit('gameWon', {
            winner: socket.username,
            message: `${socket.username} переміг у грі!`
          });

          // Clear any pending FORTUNO states
          if (state.fortunoState && state.fortunoState.fortunoButtonTimeout) {
            clearTimeout(state.fortunoState.fortunoButtonTimeout);
          }
          
          // Hide FORTUNO button for all players
          io.to(roomId).emit('hideFortunoButton');

          try {
            // Update room state in database
            room.gameStarted = false;
            await room.save();
            
            // Clear game state AFTER all notifications are sent
            delete gameStates[roomId];
            
            // Delete the room immediately
            await Room.deleteOne({ roomId });
            
            console.log(`🎮 Гра в кімнаті ${roomId} завершена, переможець: ${socket.username}`);
            console.log(`🗑️ Кімната ${roomId} видалена після перемоги`);
          } catch (err) {
            console.error('Помилка при завершенні гри:', err);
          }
          
          return; // Exit early to prevent further game state updates
        } else {
          // Player didn't say FORTUNO - add 2 cards
          console.log(`⚠️ Гравець ${socket.username} не сказав FORTUNO перед перемогою, +2 картини`);
          
          const cardsToAdd = state.deck.slice(0, 2);
          state.deck = state.deck.slice(2);
          state.hands[socket.username].push(...cardsToAdd);

          io.to(roomId).emit('fortunoMissed', {
            player: socket.username,
            message: `${socket.username} забув сказати FORTUNO! +2 картини.`
          });

          // Update player's hand
          socket.emit('updateHandAndDiscard', {
            hand: state.hands[socket.username],
            discardTop: state.discardPile[state.discardPile.length - 1]
          });
          
          // Update all players about the new hand sizes
          await emitPlayersState(roomId);
          
          // Continue the game - move to next player
          state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
          io.to(roomId).emit('turnChanged', {
            currentPlayerId: room.players[state.currentPlayerIndex]
          });
          
          return; // Exit to prevent further updates
        }
      }

      // Оновити руки всім гравцям - використовуємо список гравців з БД
      for (const playerId of room.players) {
        // Перевіряємо, чи є для цього гравця рука в стані гри
        if (state.hands[playerId]) {
          // Знаходимо сокет-ід гравця за його нікнеймом
          const playerSocketId = findSocketIdByUsername(playerId);
          if (playerSocketId) {
            io.to(playerSocketId).emit('updateHandAndDiscard', {
              hand: state.hands[playerId],
              discardTop: card
            });
          }
        }
      }
      
      // Оновлюємо інформацію про кількість карт у всіх гравців
      await emitPlayersState(roomId);
      
      // Перевіряємо, чи наступний гравець повинен пропустити хід
      const nextPlayerIndex = state.currentPlayerIndex;
      const nextPlayerId = room.players[nextPlayerIndex];
      
      if (state.skipNextTurn === nextPlayerId) {
        // Цей гравець має пропустити хід, переходимо до наступного
        state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
        // Видаляємо статус пропуску ходу
        delete state.skipNextTurn;
        
        // Повідомляємо всіх про пропуск ходу
        io.to(roomId).emit('turnSkipped', { 
          skippedPlayerId: nextPlayerId,
          currentPlayerId: room.players[state.currentPlayerIndex]
        });
      }
      
      // Оновити хід
      io.to(roomId).emit('turnChanged', {
        currentPlayerId: room.players[state.currentPlayerIndex]
      });
    } catch (err) {
      console.error('Помилка при зігранні карти:', err);
    }
  });

  socket.on('fortunoClicked', async ({ roomId }) => {
    try {
      const state = gameStates[roomId];
      if (!state || !state.fortunoState || !state.fortunoState.fortunoButtonVisible) {
        return;
      }

      // Clear the timeout since someone clicked
      if (state.fortunoState.fortunoButtonTimeout) {
        clearTimeout(state.fortunoState.fortunoButtonTimeout);
      }

      state.fortunoState.fortunoButtonVisible = false;
      state.fortunoState.fortunoButtonClickedBy = socket.username;

      // Hide FORTUNO button for all players
      io.to(roomId).emit('hideFortunoButton');

      // If the player with one card clicked FORTUNO
      if (socket.username === state.fortunoState.playerWithOneCard) {
        console.log(`✅ Гравець ${socket.username} успішно сказав FORTUNO`);
        
        // Mark FORTUNO as said and keep the state for win condition check
        state.fortunoState = {
          playerWithOneCard: socket.username,
          fortunoButtonVisible: false,
          fortunoButtonClickedBy: socket.username,
          fortunoButtonTimeout: null,
          fortunoSaid: true
        };

        io.to(roomId).emit('fortunoSuccess', {
          player: socket.username,
          message: `${socket.username} сказав FORTUNO!`
        });
      } else {
        console.log(`❌ Гравець ${socket.username} сказав FORTUNO замість ${state.fortunoState.playerWithOneCard}`);
        
        // Someone else clicked - give 2 cards to the player who had one card
        const playerToDrawCards = state.fortunoState.playerWithOneCard;
        const cardsToAdd = state.deck.slice(0, 2);
        state.deck = state.deck.slice(2);

        if (state.hands[playerToDrawCards]) {
          state.hands[playerToDrawCards].push(...cardsToAdd);
        }

        // Notify all players
        io.to(roomId).emit('fortunoFailed', {
          clickedBy: socket.username,
          penalizedPlayer: playerToDrawCards,
          message: `${socket.username} сказав FORTUNO раніше за ${playerToDrawCards}! ${playerToDrawCards} отримує +2 картини.`
        });

        // Update the penalized player's hand
        const penalizedSocket = findSocketIdByUsername(playerToDrawCards);
        if (penalizedSocket) {
          io.to(penalizedSocket).emit('updateHandAndDiscard', {
            hand: state.hands[playerToDrawCards],
            discardTop: state.discardPile[state.discardPile.length - 1]
          });
        }
        
        // Reset FORTUNO state completely
        state.fortunoState = null;
        
        // Move to the next player's turn
        state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
        io.to(roomId).emit('turnChanged', {
          currentPlayerId: room.players[state.currentPlayerIndex]
        });
      }

      // Update all players about the new hand sizes
      await emitPlayersState(roomId);
    } catch (err) {
      console.error('Помилка в fortunoClicked:', err);
    }
  });

  // Обробка завершення анімації кубика - повідомляємо сервер
  socket.on('fortunoDiceFinished', async ({ roomId }) => {
    try {
      const state = gameStates[roomId];
      if (!state || !state.fortunoPending || !state.pendingFortunoEffect) return;
      
      // Get the room to access players list
      const room = await Room.findOne({ roomId });
      if (!room) {
        console.warn(`⚠️ Кімната ${roomId} не знайдена при обробці кубика Фортуно`);
        return;
      }
      
      const diceResult = state.pendingFortunoEffect;
      
      // Застосовуємо ефект картки залежно від результату кубика
      switch (diceResult) {
        case 1: // +1 карта та пропуск ходу
          // Додаємо 1 карту гравцю, який виклав Фортуно
          if (state.deck.length > 0) {
            state.hands[state.fortunoPlayerId].push(state.deck.shift());
          }
          // Пропуск ходу - переходимо до наступного гравця
          state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
          // Розблоковуємо гру після завершення дії
          state.fortunoPending = false;
          break;
          
        case 2: // +3 картини та пропуск ходу
          // Додаємо 3 картини гравцю, який виклав Фортуно
          for (let i = 0; i < 3; i++) {
            if (state.deck.length > 0) {
              state.hands[state.fortunoPlayerId].push(state.deck.shift());
            }
          }
          // Пропуск ходу - переходимо до наступного гравця
          state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
          // Розблоковуємо гру після завершення дії
          state.fortunoPending = false;
          break;
          
        case 3: // Обмін картами з усіма гравцями по часовій стрілці та пропуск ходу
          // Зберігаємо копію рук
          const hands = {...state.hands};
          // Отримуємо порядковий номер поточного гравця
          const currentIndex = room.players.indexOf(state.fortunoPlayerId);
          // Обмінюємо картини
          for (let i = 0; i < room.players.length; i++) {
            const fromPlayerId = room.players[i];
            const toIndex = (i + 1) % room.players.length;
            const toPlayerId = room.players[toIndex];
            state.hands[toPlayerId] = hands[fromPlayerId];
          }
          // Пропуск ходу - переходимо до наступного гравця
          state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
          // Розблоковуємо гру після завершення дії
          state.fortunoPending = false;
          break;
          
        case 4: // -1 карта та пропуск ходу
          // Блокуємо гру до вибору карти
          // Розблокування в обробнику події discardCard
          
          // Повідомляємо гравця, що йому потрібно обрати карту для скидання
          const fortunoPlayerSocketId = findSocketIdByUsername(state.fortunoPlayerId);
          if (fortunoPlayerSocketId) {
            io.to(fortunoPlayerSocketId).emit('chooseCardToDiscard');
          }
          
          // Хід переходить до наступного після того, як гравець вибере карту
          // (обробляється в іншій події - discardCard)
          break;
          
        case 5: // Пропуск ходу тому, хто виклав карту Фортуно
          // Просто пропускаємо хід
          state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
          
          // Додаємо статус, що цей гравець має пропустити свій наступний хід
          state.skipNextTurn = state.fortunoPlayerId;
          
          // Розблоковуємо гру після завершення дії
          state.fortunoPending = false;
          break;
          
        case 6: // Гравець забирає карту назад та пропускає хід
          // Повертаємо карту Фортуно гравцю
          const fortunoCard = state.discardPile.pop();
          // Видаляємо результат кидка і обраний колір для повторного використання
          delete fortunoCard.diceResult;
          delete fortunoCard.chosenColor;
          state.hands[state.fortunoPlayerId].push(fortunoCard);
          
          // Пропуск ходу - переходимо до наступного гравця
          state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
          // Розблоковуємо гру після завершення дії
          state.fortunoPending = false;
          break;
      }
      
      // Видаляємо очікуючий ефект
      delete state.pendingFortunoEffect;
      
      // Оновлюємо руки всім гравцям - використовуємо список гравців з БД
      for (const playerId of room.players) {
        // Перевіряємо, чи є для цього гравця рука в стані гри
        if (state.hands[playerId]) {
          // Знаходимо сокет-ід гравця за нікнеймом
          const playerSocketId = findSocketIdByUsername(playerId);
          if (playerSocketId) {
            io.to(playerSocketId).emit('updateHandAndDiscard', {
              hand: state.hands[playerId],
              discardTop: state.discardPile[state.discardPile.length - 1]
            });
          }
        }
      }
      
      // Оновлюємо інформацію про кількість карт у всіх гравців
      await emitPlayersState(roomId);
      
      // If we need to show FORTUNO button after dice roll
      if (state.pendingFortunoButton) {
        // Clear the flag
        delete state.pendingFortunoButton;
        
        // Start FORTUNO event
        state.fortunoState = {
          playerWithOneCard: socket.username,
          fortunoButtonVisible: true,
          fortunoButtonClickedBy: null,
          fortunoButtonTimeout: setTimeout(async () => {
            const state = gameStates[roomId];
            if (!state || !state.fortunoState) return;

            const playerToDrawCards = state.fortunoState.playerWithOneCard;
            
            // Add 2 cards to the player who didn't say FORTUNO
            const cardsToAdd = state.deck.slice(0, 2);
            state.deck = state.deck.slice(2);

            if (state.hands[playerToDrawCards]) {
              state.hands[playerToDrawCards].push(...cardsToAdd);
            }

            // Hide FORTUNO button
            io.to(roomId).emit('hideFortunoButton');

            // Notify all players
            io.to(roomId).emit('fortunoTimeout', {
              penalizedPlayer: playerToDrawCards,
              message: `${playerToDrawCards} не встиг сказати FORTUNO! +2 картини.`
            });

            // Update the penalized player's hand
            const penalizedSocket = findSocketIdByUsername(playerToDrawCards);
            if (penalizedSocket) {
              io.to(penalizedSocket).emit('updateHandAndDiscard', {
                hand: state.hands[playerToDrawCards],
                discardTop: state.discardPile[state.discardPile.length - 1]
              });
            }

            // Reset FORTUNO state
            state.fortunoState = {
              playerWithOneCard: null,
              fortunoButtonVisible: false,
              fortunoButtonClickedBy: null,
              fortunoButtonTimeout: null,
              fortunoSaid: false
            };

            // Update all players about the new hand sizes
            await emitPlayersState(roomId);
          }, 5000) // 5 seconds to say FORTUNO
        };
        
        // Show FORTUNO button to all players
        io.to(roomId).emit('showFortunoButton');
      }
      
      // Якщо дія не вимагає очікування додаткового вибору (випадок 4)
      if (diceResult !== 4) {
        // Відправляємо оновлення ходу всім гравцям
        const currentPlayerId = room.players[state.currentPlayerIndex];
        
        // Перевіряємо, чи поточний гравець повинен пропустити хід
        if (state.skipNextTurn === currentPlayerId) {
          // Цей гравець має пропустити хід, переходимо до наступного
          state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
          // Видаляємо статус пропуску ходу
          delete state.skipNextTurn;
          
          // Повідомляємо всіх про пропуск ходу
          io.to(roomId).emit('turnSkipped', { 
            skippedPlayerId: currentPlayerId,
            currentPlayerId: room.players[state.currentPlayerIndex]
          });
        }
        
        // Оновити хід
        io.to(roomId).emit('turnChanged', {
          currentPlayerId: room.players[state.currentPlayerIndex]
        });
      }
    } catch (err) {
      console.error('Помилка при обробці кидка кубика Фортуно:', err);
    }
  });

  // Обробка вибору карти для скидання (для випадку 4 на кубику Фортуно)
  socket.on('discardCard', async ({ roomId, cardIndex }) => {
    const state = gameStates[roomId];
    if (!state) return;
    
    // Переконуємося, що користувач автентифікований
    if (!socket.username) {
      socket.emit('authError', { message: 'Необхідна авторизація' });
      return;
    }
    
    if (!state.fortunoPending || socket.username !== state.fortunoPlayerId) return;
    
    try {
      // Get the room to access players list
      const room = await Room.findOne({ roomId });
      if (!room) {
        console.warn(`⚠️ Кімната ${roomId} не знайдена при спробі скинути карту`);
        return;
      }
      
      const hand = state.hands[socket.username];
    
    if (cardIndex < 0 || cardIndex >= hand.length) return;
    
    // Видаляємо обрану карту та додаємо її у ПОЧАТОК відбою (внизу стопки)
    const cardToDiscard = hand.splice(cardIndex, 1)[0];
    state.discardPile.unshift(cardToDiscard);
    
    // Передаємо хід наступному гравцю
      state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
    
    // Розблоковуємо гру після завершення дії
    state.fortunoPending = false;
    
    // Оновити руки всім гравцям
    for (const playerId in state.hands) {
        // Знаходимо сокет-ід гравця за його нікнеймом
        const playerSocketId = findSocketIdByUsername(playerId);
        if (playerSocketId) {
          io.to(playerSocketId).emit('updateHandAndDiscard', {
        hand: state.hands[playerId],
        discardTop: state.discardPile[state.discardPile.length - 1]
      });
        }
    }
    
    // Оновлюємо інформацію про кількість карт у всіх гравців
    emitPlayersState(roomId);
    
    // Оновити хід
    io.to(roomId).emit('turnChanged', {
        currentPlayerId: room.players[state.currentPlayerIndex]
    });
    } catch (err) {
      console.error('Помилка при скиданні карти:', err);
    }
  });
  
    // Додаємо подію для взяття картини з колоди
  socket.on('drawCard', async ({ roomId }) => {
    const state = gameStates[roomId];
    if (!state) return;
    
    // Переконуємося, що користувач автентифікований
    if (!socket.username) {
      socket.emit('authError', { message: 'Необхідна авторизація' });
      return;
    }
    
    try {
      // Get the room to access players list
      const room = await Room.findOne({ roomId });
      if (!room) {
        console.warn(`⚠️ Кімната ${roomId} не знайдена при спробі взяти карту`);
        return;
      }
      
      const currentPlayerId = room.players[state.currentPlayerIndex];
      if (socket.username !== currentPlayerId) return; // Не твій хід

    // Взяти карту з колоди
    if (state.deck.length === 0) return; // Колода порожня
    const card = state.deck.shift();
    state.hands[currentPlayerId].push(card);

    // Оновити руку гравця
      // Знаходимо сокет-ід гравця за його нікнеймом
      const currentPlayerSocketId = findSocketIdByUsername(currentPlayerId);
      if (currentPlayerSocketId) {
        io.to(currentPlayerSocketId).emit('updateHandAndDiscard', {
          hand: state.hands[currentPlayerId],
          discardTop: state.discardPile[state.discardPile.length - 1]
        });
      }

    // Оновлюємо інформацію про кількість карт у всіх гравців
    emitPlayersState(roomId);

    // Передати хід наступному
      state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
    
    // Перевіряємо, чи наступний гравець повинен пропустити хід
      const nextPlayerId = room.players[state.currentPlayerIndex];
    
    if (state.skipNextTurn === nextPlayerId) {
      // Цей гравець має пропустити хід, переходимо до наступного
        state.currentPlayerIndex = await getNextPlayerIndex(state, roomId);
      // Видаляємо статус пропуску ходу
      delete state.skipNextTurn;
      
      // Повідомляємо всіх про пропуск ходу
      io.to(roomId).emit('turnSkipped', { 
        skippedPlayerId: nextPlayerId,
          currentPlayerId: room.players[state.currentPlayerIndex]
      });
    }
    
    io.to(roomId).emit('turnChanged', {
        currentPlayerId: room.players[state.currentPlayerIndex]
      });
    } catch (err) {
      console.error('Помилка при взятті карти:', err);
    }
  });

  // Функція для знаходження socket.id за username
  function findSocketIdByUsername(username) {
    // Знаходимо всі активні сокети
    const sockets = io.sockets.sockets;
    for (const [socketId, socketObj] of sockets) {
      if (socketObj.username === username) {
        return socketId;
      }
    }
    return null;
  }

  // Видача потрібної картини гравцю (DEV)
  socket.on('devGiveCard', ({ roomId, value, color }) => {
    const state = gameStates[roomId];
    if (!state) return;
    
    // Переконуємося, що користувач автентифікований
    if (!socket.username) {
      socket.emit('authError', { message: 'Необхідна авторизація' });
      return;
    }
    
    // Нормалізуємо значення для пошуку
    const normalizedValue = String(value).toLowerCase().trim();
    
    // Карта не знайдена в колоді
    let foundCard = null;
    
    // Спочатку шукаємо точний збіг
    const exactMatch = state.deck.findIndex(c => 
      c.color === color && 
      String(c.value).toLowerCase().trim() === normalizedValue
    );
    
    if (exactMatch !== -1) {
      // Якщо знайшли точний збіг, беремо цю карту
      foundCard = state.deck.splice(exactMatch, 1)[0];
    } else {
      // Якщо точного збігу немає, шукаємо частковий збіг
      const cardMappings = {
        'форт': ['фортуно', 'фортуна', 'wild'],
        '+3': ['+3 картини', '+3картини', 'плюс3', 'плюс 3', 'plus3', 'plus 3'],
        '+5': ['+5 карт', '+5карт', 'плюс5', 'плюс 5', 'plus5', 'plus 5'],
        'пропуск': ['пропуск ходу', 'пропуск', 'skip'],
        'оберт': ['обертання ходу', 'обертання', 'reverse']
      };
      
      // Шукаємо в першу чергу за ключовими словами
      for (const [key, variations] of Object.entries(cardMappings)) {
        if (normalizedValue.includes(key) || variations.some(v => normalizedValue.includes(v))) {
          const matchIdx = state.deck.findIndex(c => 
            c.color === color && 
            variations.some(v => String(c.value).toLowerCase().includes(v)) ||
            String(c.value).toLowerCase().includes(key)
          );
          
          if (matchIdx !== -1) {
            foundCard = state.deck.splice(matchIdx, 1)[0];
            break;
          }
        }
      }
      
      // Якщо і після цього не знайшли, шукаємо будь-яку карту потрібного кольору
      if (!foundCard) {
        const colorMatchIdx = state.deck.findIndex(c => c.color === color);
        if (colorMatchIdx !== -1) {
          foundCard = state.deck.splice(colorMatchIdx, 1)[0];
        }
      }
    }
    
    // Якщо карту знайдено, додаємо її до руки гравця
    if (foundCard) {
      // Використовуємо нікнейм користувача замість socket.id
      if (!state.hands[socket.username]) state.hands[socket.username] = [];
      state.hands[socket.username].push(foundCard);
      
      console.log(`Видано карту ${foundCard.color} ${foundCard.value} гравцю ${socket.username}`);
      
      // Оновити руку гравця
      io.to(socket.id).emit('updateHandAndDiscard', {
        hand: state.hands[socket.username],
        discardTop: state.discardPile[state.discardPile.length - 1]
      });
      
      // Оновлюємо інформацію про кількість карт у всіх гравців
      emitPlayersState(roomId);
    } else {
      console.warn(`Не вдалося знайти карту ${color} ${value} в колоді`);
    }
  });

  // Розробницька функція: взяти кілька карт з колоди
  socket.on('devDrawCards', ({ roomId, count }) => {
    const state = gameStates[roomId];
    if (!state) return;
    
    // Переконуємося, що користувач автентифікований
    if (!socket.username) {
      socket.emit('authError', { message: 'Необхідна авторизація' });
      return;
    }
    
    // Додаємо вказану кількість карт з колоди
    for (let i = 0; i < count && state.deck.length > 0; i++) {
      const card = state.deck.shift();
      // Використовуємо нікнейм користувача замість socket.id
      if (!state.hands[socket.username]) state.hands[socket.username] = [];
      state.hands[socket.username].push(card);
    }
    
    // Оновити руку гравця
    io.to(socket.id).emit('updateHandAndDiscard', {
      hand: state.hands[socket.username],
      discardTop: state.discardPile[state.discardPile.length - 1]
    });
    
    // Оновлюємо інформацію про кількість карт у всіх гравців
    emitPlayersState(roomId);
  });
  
  // Розробницька функція: зробити хід поточного гравця
  socket.on('devSetMyTurn', async ({ roomId }) => {
    const state = gameStates[roomId];
    if (!state) return;
    
    try {
      // Get the room to access players list from database
      const room = await Room.findOne({ roomId });
      if (!room) {
        console.warn(`⚠️ Кімната ${roomId} не знайдена для devSetMyTurn`);
        return;
      }
      
      // Знаходимо індекс поточного гравця в кімнаті з БД
      const currentIndex = room.players.indexOf(socket.username);
      
      if (currentIndex === -1) return; // Гравець не знайдений
      
      // Встановлюємо поточний хід на цього гравця
      state.currentPlayerIndex = currentIndex;
      
      // Оновлюємо інформацію про хід для всіх гравців
      io.to(roomId).emit('turnChanged', {
        currentPlayerId: socket.username
      });
    } catch (err) {
      console.error('Помилка devSetMyTurn:', err);
    }
  });

  // Handler for requesting updated player data
  socket.on('requestPlayerUpdate', async ({ roomId }) => {
    try {
      const room = await Room.findOne({ roomId });
      if (!room) {
        console.warn(`⚠️ Room ${roomId} not found for player update request`);
        return;
      }

      const state = gameStates[roomId];
      if (!state) {
        console.warn(`⚠️ Game state for ${roomId} not found for player update request`);
        return;
      }

      // Create player list with hand sizes
      const updatedPlayers = room.players.map(username => ({
        id: username,
        name: username,
        handSize: state.hands[username]?.length || 0
      }));

      // Send updated player list
      socket.emit('updatePlayers', { players: updatedPlayers });
      console.log(`📋 Sent updated player list to ${socket.username}`);
    } catch (err) {
      console.error('Error in requestPlayerUpdate:', err);
    }
  });

  // Вихід з кімнати (явний)
  socket.on('leaveRoom', async (data) => {
    // Handle both formats for backward compatibility
    const roomId = typeof data === 'string' ? data : data.roomId;
    const isExplicitExit = data.isExplicitExit === true;
    try {
      console.log(`🚪 Спроба виходу з кімнати ${roomId}, гравець: ${socket.username || 'неавторизований'}`);
      
      // Don't proceed if socket doesn't have username (not authenticated)
      if (!socket.username) {
        console.log(`⚠️ Неавтентифікований користувач намагається вийти з кімнати ${roomId}`);
        return;
      }
      
      // Check if this socket is actually in this room
      const isInRoom = socket.rooms.has(roomId);
      if (!isInRoom) {
        console.log(`⚠️ Сокет ${socket.id} не знаходиться в кімнаті ${roomId}, пропускаємо leaveRoom`);
        return;
      }
      
      const room = await Room.findOne({ roomId });
      if (!room) {
        console.log(`❌ Кімната ${roomId} не існує`);
        return;
      }
      
      // Remove any duplicate entries of this player before processing their leave
      const uniquePlayers = [...new Set(room.players)];
      if (uniquePlayers.length !== room.players.length) {
        console.log(`⚠️ Виявлено дублікати гравців перед виходом. Очищаємо список...`);
        console.log(`Було: ${JSON.stringify(room.players)}`);
        room.players = uniquePlayers;
        console.log(`Стало: ${JSON.stringify(room.players)}`);
      }
      
      if (room.players.includes(socket.username)) {
        // Log if this is an explicit exit
        console.log(`${isExplicitExit ? '🚪 Повний вихід' : '🔄 Тимчасовий вихід'} для гравця ${socket.username}`);
        
        if (room.gameStarted) {
          if (isExplicitExit) {
            // EXPLICIT EXIT: Completely remove player from room (can't rejoin)
            console.log(`🚪 Гравець ${socket.username} повністю виходить з кімнати ${roomId}`);
            
            // Remove player from the room database
            room.players = room.players.filter(id => id !== socket.username);
            await room.save();
            
            // IMPORTANT: Also update the game state to remove the player
            if (gameStates[roomId]) {
              // Remove the player from hands
              if (gameStates[roomId].hands) {
                delete gameStates[roomId].hands[socket.username];
              }
              
              // Adjust the current player index if needed
              if (gameStates[roomId].currentPlayerIndex >= room.players.length) {
                gameStates[roomId].currentPlayerIndex = 0;
              }
            }
            
            // Leave the socket
            socket.leave(roomId);
            socket.roomId = null;
            
            // Notify others that this player has left permanently
            io.to(roomId).emit('playerLeft', { 
              username: socket.username,
              message: `Гравець ${socket.username} вийшов з гри`
            });
            
            // Update player list for remaining players with hand sizes
            const updatedPlayers = room.players.map(username => ({
              id: username,
              name: username,
              handSize: gameStates[roomId]?.hands[username]?.length || 0
            }));
            
            io.to(roomId).emit('updatePlayers', { 
              players: updatedPlayers
            });
            
            // Check if only one player remains, end game and delete room
            if (room.players.length === 1) {
              console.log(`🏁 Залишився тільки один гравець у кімнаті ${roomId}, завершуємо гру`);
              
              // Notify the last player that they won by default
              io.to(roomId).emit('gameWon', {
                winner: room.players[0],
                message: 'Ви перемогли! Всі інші гравці вийшли.'
              });
              
              // Clear any pending FORTUNO states
              if (gameStates[roomId]?.fortunoState?.fortunoButtonTimeout) {
                clearTimeout(gameStates[roomId].fortunoState.fortunoButtonTimeout);
              }
              
              // Update room state in database
              room.gameStarted = false;
              await room.save();
              
              // Delete the room and game state
              await Room.deleteOne({ roomId });
              delete gameStates[roomId];
              console.log(`🗑️ Кімната ${roomId} видалена (залишився один гравець)`);
            } else {
              // If game continues, make sure the current player is valid
              if (gameStates[roomId]) {
                // If current player was the one who left, update turn
                const currentState = gameStates[roomId];
                const currentPlayerIdx = currentState.currentPlayerIndex;
                
                if (currentPlayerIdx >= room.players.length || 
                    room.players[currentPlayerIdx] === socket.username) {
                  // Current player left or index is invalid, update turn
                  currentState.currentPlayerIndex = currentState.currentPlayerIndex % room.players.length;
                  
                  // Notify about turn change
                  io.to(roomId).emit('turnChanged', {
                    currentPlayerId: room.players[currentState.currentPlayerIndex]
                  });
                }
              }
            }
          } else {
            // TEMPORARY LEAVE (refresh/navigation): Allow rejoining
            console.log(`🎮 Активна гра: гравець ${socket.username} тимчасово вийшов з кімнати ${roomId}`);
            
            // Add player to the disconnected players list
            if (!disconnectedPlayers.has(roomId)) {
              disconnectedPlayers.set(roomId, new Set());
            }
            disconnectedPlayers.get(roomId).add(socket.username);
            
            console.log(`👥 Відстежуємо відключених гравців для кімнати ${roomId}: ${Array.from(disconnectedPlayers.get(roomId))}`);
            
            // Just leave the socket but keep player in the database
            socket.leave(roomId);
            socket.roomId = null;
            
            // Notify others that this player has temporarily left
            io.to(roomId).emit('playerTemporarilyLeft', { 
              username: socket.username,
              message: `Гравець ${socket.username} тимчасово вийшов з гри`
            });
            
            // Check if all players have disconnected
            if (disconnectedPlayers.has(roomId) && 
                disconnectedPlayers.get(roomId).size === room.players.length) {
              console.log(`🏁 Всі гравці (${room.players.length}) відключилися з кімнати ${roomId}, видаляємо кімнату`);
              await Room.deleteOne({ roomId });
              disconnectedPlayers.delete(roomId);
              delete gameStates[roomId];
              console.log(`🗑️ Кімната ${roomId} видалена (всі гравці вийшли)`);
            } else {
              console.log(`👋 Гравець ${socket.username} тимчасово покинув кімнату ${roomId} (залишається в базі)`);
            }
          }
          
          return;
        }
        
        // For waiting rooms (not started games), proceed with standard leave logic
        // Remove player from room
        room.players = room.players.filter(id => id !== socket.username);
        
        // Always delete a waiting room if it becomes empty
        if (room.players.length === 0) {
          await Room.deleteOne({ roomId });
          console.log(`🗑️ Кімната ${roomId} видалена (waiting room, всі гравці вийшли)`);
        } else {
          try {
            await room.save();
            // Ensure no duplicates in the player list when emitting
            io.to(roomId).emit('playerJoined', { players: [...new Set(room.players)] });
          } catch (err) {
            if (err.name === 'VersionError') {
              console.log('Помилка версії документа при виході гравця, повторна спроба...');
              // Refetch the room and try again
              const refreshedRoom = await Room.findOne({ roomId });
              if (refreshedRoom) {
                // Remove the player from the refreshed list
                refreshedRoom.players = refreshedRoom.players.filter(id => id !== socket.username);
                
                // Always delete a waiting room if it becomes empty
                if (refreshedRoom.players.length === 0) {
                  await Room.deleteOne({ roomId });
                  console.log(`🗑️ Кімната ${roomId} видалена після VersionError (waiting room, всі гравці вийшли)`);
                } else {
                  await refreshedRoom.save();
                  console.log(`Оновлений список після виходу: ${JSON.stringify(refreshedRoom.players)}`);
                  // Ensure no duplicates in the player list when emitting
                  io.to(roomId).emit('playerJoined', { players: [...new Set(refreshedRoom.players)] });
                }
              }
            } else {
              console.error('Помилка оновлення списку гравців при виході:', err);
            }
          }
        }
        
        socket.leave(roomId);
        // Clear the roomId from socket
        socket.roomId = null;
        console.log(`👋 Гравець ${socket.username} вийшов з кімнати ${roomId}`);
      } else {
        console.log(`⚠️ Гравець ${socket.username} не знайдений в кімнаті ${roomId}`);
      }
    } catch (err) {
      console.error('Помилка leaveRoom:', err);
    }
  });

  // Вихід з кімнати (автоматичний при закритті вкладки)
  socket.on('disconnect', async () => {
    try {
      // Don't proceed if socket doesn't have username (not authenticated)
      if (!socket.username) {
        console.log(`Неавтентифікований користувач відключився: ${socket.id}`);
        return;
      }
      
      if (socket.roomId) {
        // Add a small delay to allow for page navigation and reconnection
        setTimeout(async () => {
          try {
            // Check if user has reconnected in another socket
            const isUserStillConnected = Array.from(io.sockets.sockets.values())
              .some(s => s.id !== socket.id && s.username === socket.username);
              
            if (isUserStillConnected) {
              console.log(`Користувач ${socket.username} перепідключився, кімната ${socket.roomId} не видаляється`);
              return;
            }
            
            const room = await Room.findOne({ roomId: socket.roomId });
            if (room && room.players.includes(socket.username)) {
              // For running games, keep the player in the list so they can reconnect later
              if (room.gameStarted) {
                console.log(`Гравець ${socket.username} тимчасово відключився від активної гри в кімнаті ${socket.roomId}`);
                
                // Add player to disconnected players list
                if (!disconnectedPlayers.has(socket.roomId)) {
                  disconnectedPlayers.set(socket.roomId, new Set());
                }
                disconnectedPlayers.get(socket.roomId).add(socket.username);
                
                console.log(`👥 Відстежуємо відключених гравців для кімнати ${socket.roomId}: ${Array.from(disconnectedPlayers.get(socket.roomId))}`);
                
                // Notify other players that this player is temporarily disconnected
                io.to(socket.roomId).emit('playerTemporarilyDisconnected', { 
                  username: socket.username,
                  message: `Гравець ${socket.username} тимчасово відключився`
                });
                
                // Check if all players have now disconnected
                if (disconnectedPlayers.has(socket.roomId) && 
                    disconnectedPlayers.get(socket.roomId).size === room.players.length) {
                  console.log(`🏁 Всі гравці (${room.players.length}) відключилися з кімнати ${socket.roomId}, видаляємо кімнату`);
                  await Room.deleteOne({ roomId: socket.roomId });
                  disconnectedPlayers.delete(socket.roomId);
                  delete gameStates[socket.roomId];
                  console.log(`🗑️ Кімната ${socket.roomId} видалена (всі гравці вийшли)`);
                } else {
                  // Don't remove the player from the room yet to allow reconnection
                  console.log(`👥 Гравець залишається в базі для можливості переп'єднання`);
                }
              } else {
                // For waiting rooms, remove the player if they disconnect
                room.players = room.players.filter(id => id !== socket.username);
                
                // Always delete empty waiting rooms
                if (room.players.length === 0) {
                  await Room.deleteOne({ roomId: socket.roomId });
                  console.log(`🗑️ Кімната ${socket.roomId} видалена (disconnect, waiting room, всі гравці вийшли)`);
                } else {
                  await room.save();
                  io.to(socket.roomId).emit('playerJoined', { players: [...new Set(room.players)] });
                  console.log(`Гравець ${socket.username} відключився від кімнати ${socket.roomId}, залишилось ${room.players.length} гравців`);
                }
              }
            }
          } catch (err) {
            console.error('Помилка при обробці відкладеного disconnect:', err);
          }
        }, 5000); // 5 seconds delay to allow reconnection during page navigation
      } else {
        console.log(`Гравець ${socket.username} відключився (не був у кімнаті)`);
      }
    } catch (err) {
      console.error('Помилка disconnect:', err);
    }
  });

  // Handle chat messages
  socket.on('sendMessage', ({ roomId, message }) => {
    if (!socket.username || !roomId) return;
    
    // Create message object
    const messageObj = {
      username: socket.username,
      text: message,
      timestamp: Date.now()
    };
    
    // Store message in room's message history
    if (!roomMessages.has(roomId)) {
      roomMessages.set(roomId, []);
    }
    roomMessages.get(roomId).push(messageObj);
    
    // Broadcast message to all users in the room
    io.to(roomId).emit('chatMessage', messageObj);
  });

  // Handle typing status
  socket.on('typing', ({ roomId, isTyping }) => {
    if (!socket.username || !roomId) return;
    
    // Update typing status for the room
    if (!typingUsers.has(roomId)) {
      typingUsers.set(roomId, new Map());
    }
    const roomTyping = typingUsers.get(roomId);
    roomTyping.set(socket.username, isTyping);
    
    // Broadcast typing status to all users in the room
    io.to(roomId).emit('userTyping', {
      username: socket.username,
      isTyping
    });
  });

  // Modify the existing joinRoom handler to include chat initialization
  socket.on('joinRoom', (roomId) => {
    // ... existing joinRoom code ...

    // Send chat history to the joining user (but no join message)
    if (roomMessages.has(roomId)) {
      const messages = roomMessages.get(roomId);
      socket.emit('chatHistory', messages);
    }
  });

  // Modify the existing leaveRoom handler to include chat cleanup
  socket.on('leaveRoom', ({ roomId, isExplicitExit }) => {
    // ... existing leaveRoom code ...

    // Clean up typing status
    if (typingUsers.has(roomId)) {
      const roomTyping = typingUsers.get(roomId);
      roomTyping.delete(socket.username);
      if (roomTyping.size === 0) {
        typingUsers.delete(roomId);
      }
    }

    // If this was the last player, clean up chat history
    Room.findOne({ roomId }).then(room => {
      if (!room || room.players.length === 0) {
        roomMessages.delete(roomId);
        typingUsers.delete(roomId);
      }
    }).catch(err => {
      console.error('Error checking room for chat cleanup:', err);
    });
  });
});

// Видаємо статичні файли React (після білду)
app.use(express.static(path.join(__dirname, '../client/dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});

// Add a cleanup function that runs periodically to check for and remove empty rooms
setInterval(async () => {
  try {
    // Check each room with disconnected players
    for (const [roomId, disconnectedSet] of disconnectedPlayers.entries()) {
      const room = await Room.findOne({ roomId });
      
      if (!room) {
        // Room no longer exists, clean up our tracking
        disconnectedPlayers.delete(roomId);
        continue;
      }
      
      // If all players in the room are disconnected, delete it
      if (disconnectedSet.size === room.players.length) {
        console.log(`🧹 Очищення: Всі гравці (${room.players.length}) відключені з кімнати ${roomId}, видаляємо кімнату`);
        await Room.deleteOne({ roomId });
        disconnectedPlayers.delete(roomId);
        delete gameStates[roomId];
        console.log(`🗑️ Кімната ${roomId} видалена (плановий підчистка)`);
      }
    }
    
    // Also check for any waiting rooms with zero players (these should never exist, but just in case)
    const emptyWaitingRooms = await Room.find({ 
      gameStarted: false, 
      players: { $size: 0 } 
    });
    
    if (emptyWaitingRooms.length > 0) {
      console.log(`🧹 Знайдено ${emptyWaitingRooms.length} порожніх кімнат очікування, видаляємо...`);
      
      for (const room of emptyWaitingRooms) {
        await Room.deleteOne({ roomId: room.roomId });
        console.log(`🗑️ Порожня кімната ${room.roomId} видалена`);
      }
    }
    
    // Check for stale waiting rooms (old rooms that are likely abandoned)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const staleWaitingRooms = await Room.find({
      gameStarted: false,
      createdAt: { $lt: oneHourAgo }
    });
    
    if (staleWaitingRooms.length > 0) {
      console.log(`🧹 Знайдено ${staleWaitingRooms.length} застарілих кімнат очікування, видаляємо...`);
      
      for (const room of staleWaitingRooms) {
        await Room.deleteOne({ roomId: room.roomId });
        console.log(`🗑️ Застаріла кімната ${room.roomId} видалена (створена ${room.createdAt})`);
      }
    }
  } catch (err) {
    console.error('Помилка під час планової очистки кімнат:', err);
  }
}, 60000); // Check every minute