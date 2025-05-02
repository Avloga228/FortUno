const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

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
    const roomId = Math.random().toString(36).substring(2, 8); // Генеруємо унікальний roomId
    const room = new Room({ roomId, players: [] });
    await room.save();
    res.json({ roomId });
  } catch (err) {
    res.status(500).json({ error: 'Помилка створення кімнати' });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // URL фронтенду
    methods: ['GET', 'POST']
  }
});

// Обробка Socket.IO подій
io.on('connection', (socket) => {
  console.log('Користувач підключився:', socket.id);

  socket.on('joinRoom', async (roomId) => {
    try {
      const room = await Room.findOne({ roomId });
      if (room) {
        socket.join(roomId);
        room.players.push(socket.id);
        await room.save();
        io.to(roomId).emit('playerJoined', { players: room.players });
      }
    } catch (err) {
      console.error('Помилка приєднання до кімнати:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Користувач відключився:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Сервер запущено на порту ${PORT}`);
});