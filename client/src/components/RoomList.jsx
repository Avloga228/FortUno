import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { socket } from '../socket';
import './RoomList.css';

const RoomList = ({ isOpen, onClose }) => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/rooms');
      const data = await response.json();
      
      if (data.rooms) {
        setRooms(data.rooms);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      setError('Не вдалося завантажити список ігор');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = (room) => {
    if (!user) {
      alert('Для приєднання до гри необхідно увійти в систему');
      return;
    }
    
    // Store room ID in localStorage
    localStorage.setItem('currentRoomId', room.roomId);
    
    // Authenticate socket before navigation
    const token = localStorage.getItem('authToken');
    if (token) {
      socket.authenticateOnce(token);
      
      // Small delay to ensure authentication completes
      setTimeout(() => {
        if (room.gameStarted) {
          // If game has already started, user can only join if they were already in the game
          if (room.players && Array.isArray(room.players) && room.players.includes(user.username)) {
            navigate(`/room/${room.roomId}`);
          } else {
            alert('Ця гра вже розпочалася. Ви не можете приєднатися.');
          }
        } else {
          // If game hasn't started, go to waiting room
          navigate(`/waiting/${room.roomId}`);
        }
        onClose();
      }, 300);
    } else {
      if (!room.gameStarted) {
        navigate(`/waiting/${room.roomId}`);
      } else {
        alert('Ця гра вже розпочалася. Ви не можете приєднатися.');
      }
      onClose();
    }
  };

  const handleRefresh = () => {
    fetchRooms();
  };

  if (!isOpen) return null;

  return (
    <div className="room-list-modal">
      <div className="room-list-content">
        <div className="room-list-header">
          <h2>Доступні ігри</h2>
          <button className="refresh-btn" onClick={handleRefresh}>Оновити</button>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        {loading ? (
          <div className="loading">Завантаження...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : rooms.length === 0 ? (
          <div className="no-rooms">Немає доступних ігор</div>
        ) : (
          <div className="rooms-container">
            <table className="rooms-table">
              <thead>
                <tr>
                  <th>Код кімнати</th>
                  <th>Гравці</th>
                  <th>Статус</th>
                  <th>Дії</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.roomId} className={room.gameStarted ? 'game-started' : ''}>
                    <td>{room.roomId}</td>
                    <td>{room.playerCount} / 4</td>
                    <td>
                      <span className={`game-status ${room.gameStarted ? 'started' : 'waiting'}`}>
                        {room.gameStarted ? 'Гра розпочата' : 'Очікування'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className={`join-room-btn ${room.gameStarted && !(room.players && Array.isArray(room.players) && room.players.includes(user?.username)) ? 'disabled' : ''}`}
                        onClick={() => handleJoinRoom(room)}
                        disabled={room.gameStarted && !(room.players && Array.isArray(room.players) && room.players.includes(user?.username))}
                      >
                        {room.gameStarted ? 
                          (room.players && Array.isArray(room.players) && room.players.includes(user?.username) ? 'Повернутись' : 'Недоступно') : 
                          'Приєднатись'
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomList; 