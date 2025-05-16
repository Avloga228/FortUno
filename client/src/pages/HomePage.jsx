import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css"; // Додаємо окремий CSS-файл для стилів
import AuthModal from "../components/AuthModal";
import RoomList from "../components/RoomList";
import { useAuth } from "../context/AuthContext";
import { socket } from "../socket";

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRoomListOpen, setIsRoomListOpen] = useState(false);
  const [actionType, setActionType] = useState(''); // 'join' or 'host'

  // Clear any existing room connections when HomePage loads
  useEffect(() => {
    // Ensure we don't have any active room connections from previous sessions
    if (socket.roomId) {
      console.log(`Clearing previous room connection: ${socket.roomId}`);
      socket.roomId = null;
    }
  }, []);

  const handleHost = async () => {
    // Check if user is logged in
    if (!user) {
      setActionType('host');
      setIsAuthModalOpen(true);
      return;
    }

    try {
      console.log('Створення кімнати...');
      
      // Include auth token in request
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:5000/api/rooms', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('API відповідь отримана:', response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Unauthorized - token expired or invalid
          setIsAuthModalOpen(true);
          return;
        }
        throw new Error(`HTTP помилка: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Дані отримані:', data);
      
      if (data.roomId) {
        // Store the created roomId in the socket to prevent leaving it
        socket.createdRoomId = data.roomId;
        
        // Ensure socket is authenticated before navigating
        if (token) {
          // Send authentication token to socket server using the new method
          socket.authenticateOnce(token);
          
          // We're already part of the room since we created it
          // Set the roomId in localStorage so it persists across page reloads
          localStorage.setItem('currentRoomId', data.roomId);
          
          // Navigate to the waiting room
          const waitingRoomUrl = `/waiting/${data.roomId}`;
          console.log('Перенаправлення на зал очікування:', waitingRoomUrl);
          navigate(waitingRoomUrl);
        } else {
          throw new Error('Відсутній токен авторизації');
        }
      } else {
        throw new Error('Не отримано roomId від сервера');
      }
    } catch (err) {
      console.error('Помилка створення кімнати:', err);
      alert('Помилка створення кімнати: ' + err.message);
    }
  };

  const handleJoin = async () => {
    // Save action type for post-login redirection
    setActionType('join');
    
    // Check if user is logged in
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    promptRoomCode();
  };

  const promptRoomCode = async () => {
    const code = prompt('Введіть код кімнати:');
    if (code) {
      try {
        const response = await fetch(`http://localhost:5000/api/rooms/${code}`);
        const data = await response.json();
        if (data.exists) {
          // Store room ID in localStorage
          localStorage.setItem('currentRoomId', code);
          
          // Authenticate socket before navigation
          const token = localStorage.getItem('authToken');
          if (token) {
            socket.authenticateOnce(token);
            
            // Small delay to ensure authentication completes
            setTimeout(() => {
              // Check if game has already started
              if (data.gameStarted) {
                // If game already started, go directly to game room
          navigate(`/room/${code}`);
              } else {
                // If game hasn't started yet, go to waiting room
                navigate(`/waiting/${code}`);
              }
            }, 300);
          } else {
            navigate(`/waiting/${code}`);
          }
        } else {
          alert('Кімнати з таким кодом не існує!');
        }
      } catch (err) {
        alert('Помилка приєднання до кімнати!');
      }
    }
  };

  // Callback for successful login/registration
  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    
    // After login/register, continue with the action that was initiated
    if (actionType === 'host') {
      handleHost();
    } else if (actionType === 'join') {
      promptRoomCode();
    }
  };

  const handleShowRoomList = () => {
    if (!user) {
      setActionType('');
      setIsAuthModalOpen(true);
      return;
    }
    setIsRoomListOpen(true);
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
        {user ? (
          <div className="user-info">
            <span className="username">Привіт, {user.username}!</span>
            <button onClick={logout} className="bottom-btn left-btn">Вийти</button>
          </div>
        ) : (
          <button className="bottom-btn left-btn" onClick={() => setIsAuthModalOpen(true)}>Увійти</button>
        )}
        <button 
          className="bottom-btn right-btn" 
          onClick={handleShowRoomList}
        >
          Список відкритих ігор
        </button>
      </div>
      
      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Room List Modal */}
      <RoomList
        isOpen={isRoomListOpen}
        onClose={() => setIsRoomListOpen(false)}
      />
    </div>
  );
}