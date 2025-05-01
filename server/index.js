const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // на час розробки, для продакшну краще вказати конкретний домен
    methods: ["GET", "POST"]
  }
});

const PORT = 5000;

// Видаємо статичні файли React (після білду)
app.use(express.static(path.join(__dirname, '../client/dist')));

let buttonState = [false, false]; // false - зелена, true - червона

io.on('connection', (socket) => {
  socket.emit('update', buttonState);

  socket.on('press', (index) => {
    buttonState[index] = true;
    io.emit('update', buttonState);

    // Через 3 секунди скидаємо стан кнопки
    setTimeout(() => {
      buttonState[index] = false;
      io.emit('update', buttonState);
    }, 3000);
  });

  socket.on('reset', () => {
    buttonState = [false, false];
    io.emit('update', buttonState);
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

server.listen(PORT, () => {
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});