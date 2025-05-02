import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css"; // Додаємо окремий CSS-файл для стилів

export default function HomePage() {
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();

  const handleHost = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (data.roomId) {
        navigate(`/room/${data.roomId}`);
      }
    } catch (err) {
      alert('Помилка створення кімнати!');
    }
  };

  const handleJoin = async () => {
    if (roomCode) {
      try {
        const response = await fetch(`http://localhost:5000/api/rooms/${roomCode}`);
        const data = await response.json();
        if (data.exists) {
          navigate(`/room/${roomCode}`);
        } else {
          alert('Кімнати з таким кодом не існує!');
        }
      } catch (err) {
        alert('Помилка приєднання до кімнати!');
      }
    }
  };

  return (
    <div className="main-bg">
      <div className="menu-card">
        <h1 className="title">🃏 FortUno</h1>
        <p className="subtitle">Онлайн карткова гра для друзів!</p>
        <button className="menu-btn host" onClick={handleHost}>Захостити гру</button>
        <div className="divider">або</div>
        <input
          className="room-input"
          value={roomCode}
          onChange={e => setRoomCode(e.target.value)}
          placeholder="Введіть код кімнати"
        />
        <button className="menu-btn join" onClick={handleJoin}>Приєднатися</button>
      </div>
    </div>
  );
}