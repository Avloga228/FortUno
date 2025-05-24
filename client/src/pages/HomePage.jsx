import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css"; // Додаємо окремий CSS-файл для стилів
import AuthModal from "../components/AuthModal";
import RoomList from "../components/RoomList";
import RulesModal from "../components/RulesModal";
import { useAuth } from "../context/AuthContext";
import { socket } from "../socket";

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRoomListOpen, setIsRoomListOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
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

  const handleJoin = () => {
    // Перевіряємо чи користувач авторизований
    if (!user) {
      setActionType('join');
      setIsAuthModalOpen(true);
      return;
    }
    
    // Показуємо список доступних ігор
    setIsRoomListOpen(true);
  };

  // Callback for successful login/registration
  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
    
    // After login/register, continue with the action that was initiated
    if (actionType === 'host') {
      handleHost();
    } else if (actionType === 'join') {
      setIsRoomListOpen(true);
    }
  };

  return (
    <div className="main-bg custom-home-bg">
      <div className="main-content">
        <div className="header-container">
          <div className="logo-container">
            <img src="/img/logo.webp" alt="FortUno" className="logo-image" />
          </div>
        </div>
        <div className="menu-buttons">
          <button className="main-btn join-btn" onClick={handleJoin}>Приєднатися до гри</button>
          <button className="main-btn host-btn" onClick={handleHost}>Хостити гру</button>
          <button className="main-btn" onClick={() => setIsRulesModalOpen(true)}>Інструкція</button>
          {user ? (
            <div className="user-info">
              <span className="username">{user.username}</span>
              <button onClick={logout} className="main-btn">Вийти</button>
            </div>
          ) : (
            <button className="main-btn" onClick={() => setIsAuthModalOpen(true)}>Увійти</button>
          )}
        </div>
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

      {/* Rules Modal */}
      <RulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
      />
    </div>
  );
}