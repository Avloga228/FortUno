const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

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