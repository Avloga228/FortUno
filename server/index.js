const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Дозволяємо CORS для фронтенду (на час розробки)
app.use(cors());

// Видаємо статичні файли React (після білду)
app.use(express.static(path.join(__dirname, '../client/dist')));

// API (можна додати пізніше)
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Привіт із бекенду!' });
});

// Всі інші запити — повертаємо index.html (SPA)
app.use((req, res, next) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});