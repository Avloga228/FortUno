const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const { generateDeck, shuffleDeck, dealCards } = require('../shared/gameLogic');
const gameStates = {};

const app = express();
app.use(cors());
app.use(express.json());

// Підключення до MongoDB
mongoose.connect('mongodb://localhost:27017/fortuno', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB підключено'))
  .catch(err => console.error('Помилка підключення до MongoDB:', err));

// Схема кімнати
const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  players: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

const Room = mongoose.model('Room', roomSchema);

// Ендпоінт для створення кімнати
app.post('/api/rooms', async (req, res) => {
  try {
    const roomId = Math.random().toString(36).substring(2, 8);
    const room = new Room({ roomId, players: [] });
    await room.save();
    res.json({ roomId });
  } catch (err) {
    res.status(500).json({ error: 'Помилка створення кімнати' });
  }
});

// Ендпоінт для перевірки існування кімнати
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    res.json({ exists: !!room });
  } catch (err) {
    res.status(500).json({ error: 'Помилка перевірки кімнати' });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Обробка Socket.IO подій
io.on('connection', (socket) => {
  console.log('Користувач підключився:', socket.id);

  // Приєднання до кімнати
  socket.on('joinRoom', async (roomId) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        socket.join(roomId);
        if (!room.players.includes(socket.id)) {
          room.players.push(socket.id);
          await room.save();
          console.log(`Гравець ${socket.id} приєднався до кімнати ${roomId}`);
        }
        socket.roomId = roomId;
        io.to(roomId).emit('playerJoined', { players: room.players });
      }
    } catch (err) {
      console.error('Помилка приєднання до кімнати:', err);
    }
  });

  // Старт гри
  socket.on('startGame', async (roomId) => {
    const room = await Room.findOne({ roomId });
    if (!room) return;

    if (room.players.length < 2) {
      // Можна надіслати повідомлення про помилку (опціонально)
      io.to(roomId).emit('errorMessage', { message: "Мінімум 2 гравці для старту гри!" });
      return;
    }

    // Генеруємо та тасуємо колоду
    let deck = shuffleDeck(generateDeck());
    // Роздаємо карти гравцям
    const { hands, deck: newDeck } = dealCards(deck, room.players);

    // Вибираємо першу карту для скидання
    const discardPile = [newDeck[0]];
    const deckAfterFirst = newDeck.slice(1);

    // Зберігаємо стан гри у пам'яті
    gameStates[roomId] = {
      deck: deckAfterFirst,
      hands,
      discardPile,
      currentPlayerIndex: 0, // Починає перший гравець
      direction: 1 // 1 - за годинниковою, -1 - проти
    };

    // Відправляємо кожному гравцю його руку
    for (const playerId of room.players) {
      io.to(playerId).emit('handDealt', {
        hand: hands[playerId],
        discardTop: discardPile[0]
      });
    }
    // Оновлюємо стан столу для всіх
    io.to(roomId).emit('gameStarted', {
      players: room.players,
      discardTop: discardPile[0]
    });
    
    const playerIds = Object.keys(hands);
    io.to(roomId).emit('turnChanged', {
      currentPlayerId: playerIds[0]
    });
  });

  // Додаємо допоміжну функцію для визначення наступного гравця
  function getNextPlayerIndex(state) {
    const n = Object.keys(state.hands).length;
    return (state.currentPlayerIndex + state.direction + n) % n;
  }

  // Викладання карти
  socket.on('playCard', ({ roomId, card }) => {
    const state = gameStates[roomId];
    if (!state) return;
    const playerIds = Object.keys(state.hands);
    const currentPlayerId = playerIds[state.currentPlayerIndex];
    if (socket.id !== currentPlayerId) return; // Не твій хід
  
    // Перевірка: чи є карта у руці гравця
    const hand = state.hands[socket.id];
    const cardIndex = hand.findIndex(
      c => c.value === card.value && c.color === card.color
    );
    if (cardIndex === -1) return; // Немає такої карти
  
    // Перевірка правил (спрощено)
    const top = state.discardPile[state.discardPile.length - 1];
    let canPlay = false;

    if (top.color === "black" && top.chosenColor) {
      // Після чорної карти дозволяється класти лише обраний колір або чорну
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
  
    // Додаємо карту у скидання
    state.discardPile.push(card);
  
    // Якщо карта +3 або +5 — дати наступному гравцю відповідну кількість карт
    if (card.value === "+3 карти" || card.value === "+5 карт") {
      const count = card.value === "+3 карти" ? 3 : 5;
      const nextIndex = getNextPlayerIndex(state);
      const nextPlayerId = playerIds[nextIndex];
      for (let i = 0; i < count; i++) {
        if (state.deck.length > 0) {
          state.hands[nextPlayerId].push(state.deck.shift());
        }
      }
      io.to(nextPlayerId).emit('updateHandAndDiscard', {
        hand: state.hands[nextPlayerId],
        discardTop: card
      });
      // Хід переходить до опонента (наступного гравця)
      state.currentPlayerIndex = nextIndex;
    } else if (card.value === "Пропуск ходу") {
      // Пропустити наступного гравця
      const n = playerIds.length;
      state.currentPlayerIndex = (state.currentPlayerIndex + 2 * state.direction + n) % n;
    } else if (card.value === "Обертання ходу") {
      const n = playerIds.length;
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
      state.currentPlayerIndex = getNextPlayerIndex(state);
    }

    // Оновити руки всім гравцям
    for (const playerId in state.hands) {
      io.to(playerId).emit('updateHandAndDiscard', {
        hand: state.hands[playerId],
        discardTop: card
      });
    }
    // Оновити хід
    io.to(roomId).emit('turnChanged', {
      currentPlayerId: playerIds[state.currentPlayerIndex]
    });
  });
  
  // Додаємо подію для взяття карти з колоди
  socket.on('drawCard', ({ roomId }) => {
    const state = gameStates[roomId];
    if (!state) return;
    const playerIds = Object.keys(state.hands);
    const currentPlayerId = playerIds[state.currentPlayerIndex];
    if (socket.id !== currentPlayerId) return; // Не твій хід

    // Взяти карту з колоди
    if (state.deck.length === 0) return; // Колода порожня
    const card = state.deck.shift();
    state.hands[currentPlayerId].push(card);

    // Оновити руку гравця
    io.to(currentPlayerId).emit('updateHandAndDiscard', {
      hand: state.hands[currentPlayerId],
      discardTop: state.discardPile[state.discardPile.length - 1]
    });

    // Передати хід наступному
    state.currentPlayerIndex = getNextPlayerIndex(state);
    io.to(roomId).emit('turnChanged', {
      currentPlayerId: playerIds[state.currentPlayerIndex]
    });
  });

  // Вихід з кімнати (явний)
  socket.on('leaveRoom', async (roomId) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room && room.players.includes(socket.id)) {
        room.players = room.players.filter(id => id !== socket.id);
        if (room.players.length === 0) {
          await Room.deleteOne({ roomId });
          console.log(`Кімната ${roomId} видалена (leaveRoom)`);
        } else {
          await room.save();
          io.to(roomId).emit('playerJoined', { players: room.players });
        }
        socket.leave(roomId);
        console.log(`Гравець ${socket.id} вийшов з кімнати ${roomId}`);
      }
    } catch (err) {
      console.error('Помилка leaveRoom:', err);
    }
  });

  // Вихід з кімнати (автоматичний при закритті вкладки)
  socket.on('disconnect', async () => {
    try {
      if (socket.roomId) {
        const room = await Room.findOne({ roomId: socket.roomId });
        if (room && room.players.includes(socket.id)) {
          room.players = room.players.filter(id => id !== socket.id);
          if (room.players.length === 0) {
            await Room.deleteOne({ roomId: socket.roomId });
            console.log(`Кімната ${socket.roomId} видалена (disconnect)`);
          } else {
            await room.save();
            io.to(socket.roomId).emit('playerJoined', { players: room.players });
          }
          console.log(`Гравець ${socket.id} відключився від кімнати ${socket.roomId}`);
        }
      } else {
        console.log(`Гравець ${socket.id} відключився (не був у кімнаті)`);
      }
    } catch (err) {
      console.error('Помилка disconnect:', err);
    }
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