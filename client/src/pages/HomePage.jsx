import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

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
      console.error('Помилка створення кімнати:', err);
    }
  };

  const handleJoin = () => {
    if (roomCode) {
      navigate(`/room/${roomCode}`);
    }
  };

  return (
    <div>
      <h1>FortUno</h1>
      <button onClick={handleHost}>Захостити</button>
      <input
        value={roomCode}
        onChange={e => setRoomCode(e.target.value)}
        placeholder="Введіть код кімнати"
      />
      <button onClick={handleJoin}>Приєднатися</button>
    </div>
  );
} 