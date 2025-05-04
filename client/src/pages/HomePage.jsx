import React from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css"; // Додаємо окремий CSS-файл для стилів

export default function HomePage() {
  const navigate = useNavigate();

  const handleHost = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
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
    const code = prompt('Введіть код кімнати:');
    if (code) {
      try {
        const response = await fetch(`http://localhost:5000/api/rooms/${code}`);
        const data = await response.json();
        if (data.exists) {
          navigate(`/room/${code}`);
        } else {
          alert('Кімнати з таким кодом не існує!');
        }
      } catch (err) {
        alert('Помилка приєднання до кімнати!');
      }
    }
  };

  return (
    <div className="main-bg custom-home-bg">
      <div className="main-content">
        <h1 className="main-title">FORTUNO</h1>
        <div className="cards-svg">
          <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="20" width="60" height="40" rx="8" fill="#185a9d" stroke="#fff" strokeWidth="4"/>
            <rect x="25" y="10" width="60" height="40" rx="8" fill="#ff6f61" stroke="#fff" strokeWidth="4"/>
            <rect x="35" y="25" width="60" height="40" rx="8" fill="#43cea2" stroke="#fff" strokeWidth="4"/>
            <rect x="50" y="15" width="60" height="40" rx="8" fill="#ffe066" stroke="#fff" strokeWidth="4"/>
            <ellipse cx="65" cy="35" rx="22" ry="15" fill="#fff"/>
            <path d="M65 20 A15 15 0 0 1 80 35 A15 15 0 0 1 65 50 A15 15 0 0 1 50 35 A15 15 0 0 1 65 20 Z" fill="#43cea2"/>
            <path d="M65 20 A15 15 0 0 1 80 35 L65 35 Z" fill="#ff6f61"/>
            <path d="M80 35 A15 15 0 0 1 65 50 L65 35 Z" fill="#ffe066"/>
            <path d="M65 50 A15 15 0 0 1 50 35 L65 35 Z" fill="#185a9d"/>
            <path d="M50 35 A15 15 0 0 1 65 20 L65 35 Z" fill="#fff"/>
          </svg>
        </div>
        <div className="menu-buttons">
          <button className="main-btn join-btn" onClick={handleJoin}>Приєднатися до гри</button>
          <button className="main-btn host-btn" onClick={handleHost}>Хостити гру</button>
          <button className="main-btn" disabled>Інструкція</button>
          <button className="main-btn" disabled>Таблиця лідерів</button>
        </div>
      </div>
      <div className="bottom-bar">
        <button className="bottom-btn left-btn" disabled>Увійти</button>
        <button className="bottom-btn right-btn" disabled>Список відкритих ігор</button>
      </div>
    </div>
  );
}