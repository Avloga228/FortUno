import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../socket";
import { useAuth } from "../context/AuthContext";
import "./WaitingRoom.css";

export default function WaitingRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  
  useEffect(() => {
    // Check if room exists
    const checkRoomExists = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/rooms/${roomId}`);
        const data = await response.json();
        
        if (!data.exists) {
          setError("Кімната не існує");
          return;
        }
        
        // Check if game already started
        if (data.gameStarted) {
          console.log("Game already started, redirecting to game room");
          // If game already started, redirect to game room
          navigate(`/room/${roomId}`);
          return;
        }
      } catch (err) {
        console.error('Помилка перевірки кімнати:', err);
        setError("Помилка з'єднання з сервером");
      }
    };
    
    checkRoomExists();
    
    // Setup handler for browser navigation (back/forward buttons)
    const handleBrowserNavigation = (event) => {
      // If user navigated here with back button and was in a game
      const currentRoomId = localStorage.getItem('currentRoomId');
      const wasInGame = localStorage.getItem('inGameState');
      
      if (currentRoomId === roomId && wasInGame === 'true') {
        console.log('Detected navigation from game room, redirecting back');
        // Redirect back to the game
        window.location.replace(`/room/${roomId}`);
      }
    };

    // Run once when component mounts
    handleBrowserNavigation();
    
    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', handleBrowserNavigation);
    
    // Setup socket event listeners
    socket.on('playerJoined', (data) => {
      console.log('Players in waiting room:', data.players);
      setPlayers(data.players);
      
      // Determine if current user is the host (first player)
      if (data.players.length > 0) {
        const firstPlayer = data.players[0];
        const firstPlayerId = typeof firstPlayer === 'object' ? firstPlayer.id : firstPlayer;
        setIsHost(firstPlayerId === user?.username);
      }
    });
    
    socket.on('gameStarted', ({ players, discardTop }) => {
      console.log('WaitingRoom: Game started event received');
      
      // When game starts, immediately set up redirect to prevent rendering errors
      localStorage.setItem('redirectToGame', 'true');
      localStorage.setItem('currentRoomId', roomId);
      localStorage.setItem('inGameState', 'true');

      // Force redirect to game page immediately
      window.location.href = `/room/${roomId}`;
    });
    
    socket.on('redirectToGameRoom', ({ roomId }) => {
      console.log(`WaitingRoom: Received redirect to game room command for ${roomId}`);
      
      // Immediately prevent further state updates to avoid React errors
      setError("Перенаправлення до гри...");
      
      // Set all necessary localStorage flags first
      localStorage.setItem('redirectToGame', 'true');
      localStorage.setItem('currentRoomId', roomId);
      localStorage.setItem('inGameState', 'true');
      
      // Function to handle the redirect
      const performRedirect = () => {
        console.log(`WaitingRoom: Forcing redirect to /room/${roomId}`);
        
        // Force page reload with the new URL - use replace to prevent back navigation issues
        window.location.replace(`/room/${roomId}`);
      };

      // Do the redirect immediately
      performRedirect();
    });
    
    socket.on('roomNotFound', () => {
      setError("Кімната не існує");
    });
    
    socket.on('gameAlreadyStarted', () => {
      setError("Гра вже розпочалася");
    });
    
    // Join the room
    const token = localStorage.getItem('authToken');
    if (token) {
      socket.authenticateOnce(token);
      socket.emit('joinRoom', roomId);
    }
    
    return () => {
      // Cleanup socket listeners
      socket.off('playerJoined');
      socket.off('gameStarted');
      socket.off('roomNotFound');
      socket.off('gameAlreadyStarted');
      socket.off('redirectToGameRoom');
      socket.off('errorMessage');
      window.removeEventListener('popstate', handleBrowserNavigation);
      
      console.log('WaitingRoom: Cleaned up event listeners');
    };
  }, [roomId, user, navigate]);
  
  const handleStartGame = () => {
    socket.emit('startGame', roomId);
  };
  
  const handleCopyLink = () => {
    const roomLink = `${window.location.origin}/waiting/${roomId}`;
    navigator.clipboard.writeText(roomLink)
      .then(() => {
        setCopySuccess("Посилання скопійовано!");
        setTimeout(() => setCopySuccess(""), 2000);
      })
      .catch(() => {
        setCopySuccess("Не вдалося скопіювати");
      });
  };
  
  const handleLeaveRoom = () => {
    // Tell the server we're leaving with explicit exit flag
    socket.emit('leaveRoom', { roomId, isExplicitExit: true });
    
    // Clear any local storage related to this room
    localStorage.removeItem('currentRoomId');
    localStorage.removeItem('inGameState');
    
    // Navigate to home page
    navigate('/');
  };
  
  if (error) {
    return (
      <div className="waiting-room error">
        <h2>Помилка</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')}>Повернутися на головну</button>
      </div>
    );
  }
  
  const canStartGame = players.length >= 2;
  
  return (
    <div className="waiting-room">
      <h1>Зал очікування</h1>
      <h2>Кімната: {roomId}</h2>
      
      <div className="room-info">
        <button className="copy-button" onClick={handleCopyLink}>
          Скопіювати посилання
        </button>
        {copySuccess && <span className="copy-success">{copySuccess}</span>}
      </div>
      
      <div className="players-list">
        <h3>Гравці ({players.length}/4):</h3>
        <ul>
          {players.map((player, index) => {
            // Handle both string players and object players
            const playerId = typeof player === 'object' ? player.id : player;
            const playerName = typeof player === 'object' ? player.name : player;
            
            return (
              <li key={playerId || index}>
                {playerName} {index === 0 ? "(Господар)" : ""}
                {playerId === user?.username ? " (Ви)" : ""}
              </li>
            );
          })}
        </ul>
      </div>
      
      {players.length < 2 && (
        <div className="waiting-message">
          <p>Очікування інших гравців...</p>
          <p>Для початку гри потрібно щонайменше 2 гравці</p>
        </div>
      )}
      
      <div className="waiting-actions">
        {isHost && (
          <button 
            className={`start-game-btn ${!canStartGame ? 'disabled' : ''}`}
            disabled={!canStartGame}
            onClick={handleStartGame}
          >
            Розпочати гру
          </button>
        )}
        
        <button className="leave-room-btn" onClick={handleLeaveRoom}>
          Вийти з кімнати
        </button>
      </div>
    </div>
  );
} 