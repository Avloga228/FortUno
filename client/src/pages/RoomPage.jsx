import React, { useEffect, useState, Component } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../socket";
import { useAuth } from "../context/AuthContext";
import AuthModal from "../components/AuthModal";
import { toast } from "react-hot-toast";

// Імпортуємо компоненти
import GameTable from "../components/GameTable";
import GameHeader from "../components/GameHeader";
import CardDeck from "../components/CardDeck";
import PlayerHand from "../components/PlayerHand";
import OpponentView from "../components/OpponentView";
import ColorPicker from "../components/ColorPicker";
import DiceRoller from "../components/DiceRoller";
import FortunoButton from '../components/FortunoButton';
import GameEndModal from '../components/GameEndModal';
import GameChat from '../components/GameChat';

import "./RoomPage.css";

// Додати компонент ErrorBoundary
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Помилка в компоненті:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Щось пішло не так</h2>
          <details>
            <summary>Деталі помилки</summary>
            <p>{this.state.error && this.state.error.toString()}</p>
          </details>
          <button onClick={() => this.setState({ hasError: false })}>
            Спробувати знову
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function RoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  console.log(`RoomPage init: roomId=${roomId}`);
  
  const [players, setPlayers] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [hand, setHand] = useState([]);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingBlackCard, setPendingBlackCard] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [chooseCardToDiscard, setChooseCardToDiscard] = useState(false);
  const [actionBlockedMessage, setActionBlockedMessage] = useState("");
  const [diceResult, setDiceResult] = useState(null);
  const [turnSkippedMessage, setTurnSkippedMessage] = useState("");
  const [pageLoaded, setPageLoaded] = useState(false);
  const [roomExists, setRoomExists] = useState(true);
  const [devPanelExpanded, setDevPanelExpanded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showFortunoButton, setShowFortunoButton] = useState(false);
  const [showGameEndModal, setShowGameEndModal] = useState(false);
  const [gameEndMessage, setGameEndMessage] = useState("");
  const [gameWinner, setGameWinner] = useState(null);
  const [isFortunoVisible, setIsFortunoVisible] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(true);

  // Перевірка авторизації при завантаженні
  useEffect(() => {
    if (!user && pageLoaded) {
      setShowAuthModal(true);
    }
  }, [user, pageLoaded]);
  
  // Перше завантаження - примусове оновлення через 1 секунду
  useEffect(() => {
    console.log('RoomPage: Initial load effect running');
    
    // Check if we're coming from a redirect
    const redirectToGame = localStorage.getItem('redirectToGame');
    const currentRoomId = localStorage.getItem('currentRoomId');
    
    if (redirectToGame === 'true' && currentRoomId === roomId) {
      console.log('RoomPage: Detected redirect from waiting room');
      // Clear the redirect flag since we're now in the game
      localStorage.removeItem('redirectToGame');
      // Ensure game state is set
      localStorage.setItem('inGameState', 'true');
      // Set game as started if we're coming from redirect
      setGameStarted(true);
      
      // Force a check for game state after a short delay
      setTimeout(() => {
        console.log('RoomPage: Forced check for game state after redirect');
        // Trigger socket reconnection if needed
        if (!socket.connected) {
          socket.reconnectExplicit();
        }
        
        // If we have a token, ensure we're authenticated and in the room
        const token = localStorage.getItem('authToken');
        if (token && user) {
          socket.authenticateOnce(token);
          socket.emit('joinRoom', roomId);
          setHasJoinedRoom(true);
        }
      }, 500);
    }
    
    const timer = setTimeout(() => {
      setPageLoaded(true);
      console.log('RoomPage: Page fully loaded');
      
      // Перевірка авторизації після завантаження
      if (!user) {
        setShowAuthModal(true);
      }
      
      // Mark that we are in the game (for handling browser navigation)
      localStorage.setItem('inGameState', 'true');
      localStorage.setItem('currentRoomId', roomId);
      
      // Hide loading indicator after a small delay
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }, 500); // Reduced timeout for faster loading
    
    // Add a safety timeout to hide the loading indicator even if other events fail
    const safetyTimer = setTimeout(() => {
      if (isLoading) {
        console.log('RoomPage: Safety timeout reached, forcing load completion');
        setIsLoading(false);
        // If we're still loading but timeout reached, force reload the page
        if (!gameStarted && !currentCard) {
          console.log('RoomPage: Game data not loaded, forcing page reload');
          window.location.reload();
        }
      }
    }, 5000);
    
    // Handle cleanup and browser navigation
    return () => {
      clearTimeout(timer);
      clearTimeout(safetyTimer);
      
      // If leaving the page, check if we should keep game state
      // Remove the inGameState flag only if we're not navigating to waiting room
      // or if leaving the app entirely
      if (!window.location.pathname.includes('/waiting/') && 
          !window.location.pathname.includes('/room/')) {
        localStorage.removeItem('inGameState');
      }
    };
  }, [user, roomId, isLoading, gameStarted, currentCard]);

  // Prevent going back from active game with browser history
  useEffect(() => {
    // This function will be called when the component mounts
    const blockHistoryNavigation = () => {
      // Push additional history entry to prevent easy back navigation
      window.history.pushState(null, '', window.location.pathname);
      
      // This handler will fire when user clicks back button
      const handlePopState = (event) => {
        // Prevent going back by pushing another state
        window.history.pushState(null, '', window.location.pathname);
        
        // Show a message explaining they can't use the back button
        alert('Щоб вийти з гри, використовуйте кнопку "Повернутись на головну"');
      };
      
      // Add listener for popstate (back/forward buttons)
      window.addEventListener('popstate', handlePopState);
      
      // Return cleanup function
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    };
    
    // Only block navigation if the game has started
    let cleanup = null;
    if (gameStarted) {
      cleanup = blockHistoryNavigation();
    }
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [gameStarted]);

  // Simplified socket connection and authentication
  useEffect(() => {
    console.log('RoomPage: Setting up socket connection');
    
    // Clear socket listeners to prevent duplicates
    const cleanupSocketListeners = () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('error');
      socket.off('connect_failed');
      socket.off('authError');
      socket.off('playerJoined');
      socket.off('handDealt');
      socket.off('updateHandAndDiscard');
      socket.off('turnChanged');
      socket.off('gameStarted');
      socket.off('updatePlayers');
      socket.off('playerLeft');
      socket.off('playerTemporarilyLeft');
      socket.off('fortunoDiceRolled');
      socket.off('chooseCardToDiscard');
      socket.off('actionBlocked');
      socket.off('turnSkipped');
      socket.off('roomNotFound');
      socket.off('gameEnded');
      socket.off('showFortunoButton');
      socket.off('hideFortunoButton');
      socket.off('fortunoSuccess');
      socket.off('fortunoFailed');
      socket.off('fortunoTimeout');
      socket.off('fortunoMissed');
      socket.off('gameWon');
    };

    // Clean up existing listeners
    cleanupSocketListeners();

    // Single authentication and join room function
    const setupConnection = () => {
      if (!user || hasJoinedRoom) return;

      const token = localStorage.getItem('authToken');
      if (!token) return;

      // First authenticate the socket (using the new method)
      socket.authenticateOnce(token);

      // Then join the room after a short delay
      setTimeout(() => {
        console.log(`RoomPage: Joining room: ${roomId}`);
        socket.emit('joinRoom', roomId);
        setHasJoinedRoom(true);
        
        // Store the current room ID in localStorage
        localStorage.setItem('currentRoomId', roomId);
      }, 200);
    };

    // Check if we're already in a game from a redirect
    const checkRedirectFromGame = () => {
      const redirectToGame = localStorage.getItem('redirectToGame');
      if (redirectToGame === 'true') {
        console.log('RoomPage: Coming from a game redirect, ensuring connection');
        // Clear the redirect flag
        localStorage.removeItem('redirectToGame');
        
        if (user && !hasJoinedRoom) {
          // Force rejoin if we're coming from a redirect
          const token = localStorage.getItem('authToken');
          if (token) {
            socket.authenticateOnce(token);
            setTimeout(() => {
              console.log(`RoomPage: Forced join after redirect to room: ${roomId}`);
              socket.emit('joinRoom', roomId);
              setHasJoinedRoom(true);
            }, 200);
          }
        }
      }
    };

    // Run checks for redirect status
    checkRedirectFromGame();

    // Setup connection when component mounts
    setupConnection();

    // Handle connection events
    socket.on('connect', () => {
      console.log('Connected to server, socket ID:', socket.id);
      
      // Only re-join on reconnection if we were previously joined
      if (user && hasJoinedRoom) {
        console.log('Reconnected - re-authenticating...');
        const token = localStorage.getItem('authToken');
        if (token) {
          socket.authenticateOnce(token);
          
          // Small delay before rejoining the room
          setTimeout(() => {
            console.log(`Rejoining room after reconnection: ${roomId}`);
            socket.emit('joinRoom', roomId);
          }, 200);
        }
      } else {
        setupConnection();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    socket.on('roomNotFound', (data) => {
      console.error('Room not found:', data.message);
      setRoomExists(false);
      setActionBlockedMessage('Кімната не існує');
    });

    socket.on('authError', (data) => {
      console.error('Authentication error:', data.message);
      setShowAuthModal(true);
    });

    // Game state events
    socket.on('playerJoined', (data) => {
      console.log('RoomPage: Players in room:', data.players);
      setPlayers(data.players);
    });

    socket.on('handDealt', ({ hand, discardTop }) => {
      console.log('RoomPage: Hand dealt received');
      setHand(hand);
      setCurrentCard(discardTop);
      // If we received a hand, we're definitely in a game
      setGameStarted(true);
    });

    socket.on('updateHandAndDiscard', ({ hand, discardTop }) => {
      console.log('RoomPage: Hand updated');
      setHand(hand);
      setCurrentCard(discardTop);
    });

    socket.on('turnChanged', ({ currentPlayerId }) => {
      console.log(`RoomPage: Turn changed to ${currentPlayerId}`);
      setCurrentPlayerId(currentPlayerId);
      setShowColorPicker(false);
      setPendingBlackCard(null);
      setActionBlockedMessage("");
    });

    socket.on('gameStarted', ({ discardTop, players }) => {
      console.log('RoomPage: Game started event received', { discardTop, players });
      if (discardTop) {
        setCurrentCard(discardTop);
      }
      if (players && Array.isArray(players)) {
        setPlayers(players);
      }
      setGameStarted(true);
      
      // Store room ID in localStorage when game starts
      localStorage.setItem('currentRoomId', roomId);
      localStorage.setItem('inGameState', 'true');
    });

    socket.on('updatePlayers', ({ players }) => {
      setPlayers(players);
    });

    socket.on('playerLeft', ({ username, message }) => {
      console.log(`Player left: ${username}`);
      
      // Display a notification that a player left
      setActionBlockedMessage(message);
      setTimeout(() => setActionBlockedMessage(""), 3000);
      
      // We'll get a full player update from the server via updatePlayers event
      // This is just a backup filter in case that doesn't come through
      setPlayers(prevPlayers => prevPlayers.filter(p => p.id !== username));
      
      // Request updated player data from server
      socket.emit('requestPlayerUpdate', { roomId });
    });

    socket.on('fortunoDiceRolled', ({ diceResult, playerId }) => {
      setDiceResult(diceResult);
      setShowDiceRoller(true);
    });

    socket.on('chooseCardToDiscard', () => {
      setChooseCardToDiscard(true);
    });

    socket.on('actionBlocked', ({ message }) => {
      setActionBlockedMessage(message);
      setTimeout(() => {
        setActionBlockedMessage("");
      }, 3000);
    });

    socket.on('turnSkipped', ({ skippedPlayerId, currentPlayerId }) => {
      const isCurrentUser = skippedPlayerId === socket.username;
      const message = isCurrentUser 
        ? "Ви пропускаєте свій хід через карту Фортуно" 
        : "Гравець пропускає свій хід через карту Фортуно";
      
      setTurnSkippedMessage(message);
      setTimeout(() => {
        setTurnSkippedMessage("");
      }, 3000);
    });
    
    // Listen for game ended event (when only one player remains)
    socket.on('gameEnded', ({ message }) => {
      // Show message to the user
      alert(message);
      
      // Redirect to home
      localStorage.removeItem('inGameState');
      localStorage.removeItem('currentRoomId');
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    });

    socket.on('showFortunoButton', () => {
      setIsFortunoVisible(true);
    });

    socket.on('hideFortunoButton', () => {
      setIsFortunoVisible(false);
    });

    socket.on('fortunoSuccess', ({ player, message }) => {
      toast.success(message);
    });

    socket.on('fortunoFailed', ({ clickedBy, penalizedPlayer, message }) => {
      toast.warning(message);
    });

    socket.on('fortunoTimeout', ({ penalizedPlayer, message }) => {
      toast.error(message);
    });

    socket.on('fortunoMissed', ({ player, message }) => {
      toast.error(message);
    });

    socket.on('gameWon', ({ winner, message }) => {
      toast.success(message);
      setGameWinner(winner);
      
      // Show game end modal
      setShowGameEndModal(true);
      setGameEndMessage(message);
      
      // Clear game state
      localStorage.removeItem('inGameState');
      localStorage.removeItem('currentRoomId');
      
      // Hide FORTUNO button if it's visible
      setIsFortunoVisible(false);
      
      // Clear any pending states
      setShowColorPicker(false);
      setPendingBlackCard(null);
      setChooseCardToDiscard(false);
      setShowDiceRoller(false);

      // Automatically redirect all players to home after a short delay
      setTimeout(() => {
        // Send explicit leave to ensure room cleanup
        socket.emit('leaveRoom', { roomId, isExplicitExit: true });
        // Redirect to home
        window.location.href = '/';
      }, 3000); // 3 seconds delay to show the win message
    });

    return () => {
      // Send leave message once when unmounting (not an explicit exit)
      if (hasJoinedRoom) {
        console.log(`Leaving room: ${roomId}`);
        socket.emit('leaveRoom', { roomId, isExplicitExit: false });
      }
      
      // Clear localStorage
      localStorage.removeItem('currentRoomId');
      
      // Clean up all listeners
      cleanupSocketListeners();
    };
  }, [roomId, user, hasJoinedRoom]);

  // Додати ефект для перевірки існування кімнати
  useEffect(() => {
    // Detect when user is about to navigate away from the room
    const handleBeforeNavigate = (e) => {
      const destination = e.target.pathname;
      
      // If we're navigating to the home page or any other non-game page
      if (!destination.includes(`/room/${roomId}`) && 
          !destination.includes(`/waiting/${roomId}`)) {
        // Clear the game state so we don't try to rejoin
        localStorage.removeItem('inGameState');
        localStorage.removeItem('currentRoomId');
        
        // Tell server we're leaving the room (not an explicit exit)
        if (socket && hasJoinedRoom) {
          socket.emit('leaveRoom', { roomId, isExplicitExit: false });
        }
      }
    };
    
    // Add listener for link clicks
    const handleLinkClick = (e) => {
      if (e.target.tagName === 'A') {
        handleBeforeNavigate(e);
      }
    };
    
    document.addEventListener('click', handleLinkClick);
    
    // Перевіряємо, чи існує кімната
    const checkRoomExists = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/rooms/${roomId}`);
        const data = await response.json();
        
        if (!data.exists) {
          console.error(`Кімната ${roomId} не існує`);
          setRoomExists(false);
          setActionBlockedMessage('Кімната не існує');
        } else {
          console.log(`Кімната ${roomId} існує`);
          setRoomExists(true);
          
          // Check if game has not started yet, redirect to waiting room
          if (!data.gameStarted) {
            console.log('Гра ще не розпочалася, перенаправлення до залу очікування');
            navigate(`/waiting/${roomId}`);
          }
        }
      } catch (err) {
        console.error('Помилка перевірки кімнати:', err);
        setActionBlockedMessage('Помилка з\'єднання з сервером');
      }
    };
    
    checkRoomExists();
    
    return () => {
      document.removeEventListener('click', handleLinkClick);
    };
  }, [roomId, navigate]);

  // Фільтруємо опонентів (всі гравці, крім поточного) і забираємо undefined/null
  const opponents = players.filter(p => p && p.id && p.id !== user?.username);

  // Функція для визначення позиції опонента відносно поточного гравця
  const getOpponentPosition = (opponentIndex, currentPlayerIndex, totalPlayers) => {
    // Визначаємо відносну позицію опонента
    let relativePosition = (opponentIndex - currentPlayerIndex + totalPlayers) % totalPlayers;
    if (relativePosition <= 0) relativePosition += totalPlayers;
    return relativePosition;
  };

  // Знаходимо індекс поточного гравця
  const currentPlayerIndex = players.findIndex(p => p.id === user?.username);

  // Сортуємо опонентів за їх позиціями відносно поточного гравця
  const sortedOpponents = [...opponents].sort((a, b) => {
    const aIndex = players.findIndex(p => p.id === a.id);
    const bIndex = players.findIndex(p => p.id === b.id);
    const aPosition = getOpponentPosition(aIndex, currentPlayerIndex, players.length);
    const bPosition = getOpponentPosition(bIndex, currentPlayerIndex, players.length);
    return aPosition - bPosition;
  });
  
  // Клік по картці для викладання або скидання
  const handlePlayCard = (cardOrIndex, isDiscard = false) => {
    if (currentPlayerId !== user?.username) return;
    
    if (isDiscard) {
      // Скидання карти для ефекту Фортуно №4 (-1 карта)
      socket.emit('discardCard', { roomId, cardIndex: cardOrIndex });
      setChooseCardToDiscard(false);
    } else {
      // Звичайний хід картою
      if (cardOrIndex.color === "black") {
        setShowColorPicker(true);
        setPendingBlackCard(cardOrIndex);
      } else {
        socket.emit('playCard', { roomId, card: cardOrIndex });
      }
    }
  };

  // Вибір кольору для чорної картини
  const handleColorPick = (color) => {
    setShowColorPicker(false);
    if (pendingBlackCard) {
      socket.emit('playCard', { roomId, card: { ...pendingBlackCard, chosenColor: color } });
      setPendingBlackCard(null);
    }
  };

  // Обробка результату кидання кубика
  const handleDiceResult = (result) => {
    // Не закриваємо модальне вікно одразу
    // Компонент сам ховає результат через 5 секунд
    setTimeout(() => {
      setShowDiceRoller(false);
    }, 5000); // Закриваємо модальне вікно через 5 секунд після завершення анімації
  };

  // Обробка завершення анімації кубика - повідомляємо сервер
  const handleDiceFinished = () => {
    socket.emit('fortunoDiceFinished', { roomId });
  };

  // Взяти карту з колоди
  const handleDrawCard = () => {
    if (currentPlayerId !== user?.username) return;
    socket.emit('drawCard', { roomId });
  };

  // Функція для розгортання/згортання панелі розробника
  const toggleDevPanel = () => {
    setDevPanelExpanded(!devPanelExpanded);
  };

  // Callback для успішної авторизації
  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    // Приєднатися до кімнати після авторизації
    if (roomId) {
      socket.emit('joinRoom', roomId);
    }
  };

  // Додати умовний рендерінг компонентів на основі існування кімнати
  if (!roomExists) {
    return (
      <div className="game-page">
        <div className="room-not-found">
          <h2>Кімната не знайдена</h2>
          <p>Кімната з ідентифікатором "{roomId}" не існує.</p>
          <button onClick={() => window.location.href = '/'}>
            Повернутися на головну
          </button>
        </div>
      </div>
    );
  }

  // Add a button to safely leave the game
  const handleLeaveGame = () => {
    // Leave the room with explicit exit flag
    if (socket && hasJoinedRoom) {
      socket.emit('leaveRoom', { roomId, isExplicitExit: true });
    }
    
    // Clear game state
    localStorage.removeItem('inGameState');
    localStorage.removeItem('currentRoomId');
    
    // Return to home
    window.location.href = '/';
  };

  // Add FORTUNO click handler
  const handleFortunoClick = () => {
    socket.emit('fortunoClicked', { roomId });
  };

  // Add function to handle returning to home after game end
  const handleReturnHome = () => {
    navigate('/');
  };

  return (
    <ErrorBoundary>
      <div className="game-page">
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <div className="loading-text">Завантаження гри...</div>
          </div>
        )}
        
        {/* Шапка гри */}
        <ErrorBoundary>
          <GameHeader 
            roomId={roomId}
            playersCount={players.length}
            isCurrentPlayerTurn={currentPlayerId === user?.username}
            actionBlockedMessage={actionBlockedMessage}
            turnSkippedMessage={turnSkippedMessage}
            onLeaveGame={handleLeaveGame}
          />
        </ErrorBoundary>
        
        {/* Ігровий стіл */}
        <div className="game-area">
          {/* Опоненти — позиціонуються абсолютно відносно game-area */}
          {sortedOpponents.map((player, index) => (
            <ErrorBoundary key={`opponent-boundary-${player.id || index}`}>
              <OpponentView 
                key={player.id || `opponent-${index}`}
                player={player}
                position={index + 1}
                isCurrentTurn={currentPlayerId === player.id}
                totalPlayers={players.length}
              />
            </ErrorBoundary>
          ))}

          {/* Рука гравця — абсолютне позиціонування в game-area */}
          <ErrorBoundary>
            <PlayerHand 
              hand={hand} 
              isCurrentPlayerTurn={currentPlayerId === user?.username}
              onPlayCard={handlePlayCard}
              chooseCardToDiscard={chooseCardToDiscard}
            />
          </ErrorBoundary>

          {/* Ігровий стіл з колодою і відбоєм */}
          <ErrorBoundary>
            <GameTable>
              <CardDeck
                currentCard={currentCard}
                onDrawCard={handleDrawCard}
                isCurrentPlayerTurn={currentPlayerId === user?.username}
              />
            </GameTable>
          </ErrorBoundary>
        </div>

        
        {/* Модальні вікна */}
        {showColorPicker && (
          <div className="modal-overlay">
            <ColorPicker onPick={handleColorPick} />
          </div>
        )}
        
        {showDiceRoller && (
          <div className="modal-overlay">
            <DiceRoller 
              onResult={handleDiceResult} 
              serverDiceResult={diceResult} 
              onFinished={handleDiceFinished} 
            />
          </div>
        )}
        
        {/* Dev-панель з можливістю розгортання/згортання */}
        <div className={`dev-panel ${devPanelExpanded ? 'expanded' : ''}`}>
          <button className="dev-panel-toggle" onClick={toggleDevPanel}>
            {devPanelExpanded ? 'Сховати інструменти' : 'Показати інструменти'}
            <span className="toggle-icon">▼</span>
          </button>
          
          {/* Відображаємо кнопки розробника тільки якщо гра почалася і панель розгорнута */}
          {gameStarted && devPanelExpanded && (
            <>
              <button onClick={() => socket.emit('devGiveCard', { roomId, value: 'ФортУно', color: 'black' })}>
                Фортуно
              </button>
              
              <button onClick={() => socket.emit('devGiveCard', { roomId, value: 'Пропуск ходу', color: 'red' })}>
                Пропуск
              </button>
              
              <button onClick={() => socket.emit('devGiveCard', { roomId, value: 'Обертання ходу', color: 'blue' })}>
                Обертання ходу
              </button>
              
              <button onClick={() => socket.emit('devGiveCard', { roomId, value: '+3 картини', color: 'black' })}>
                +3 картини
              </button>
              
              <button onClick={() => socket.emit('devGiveCard', { roomId, value: '+5 карт', color: 'black' })}>
                +5 карт
              </button>
              
              <button onClick={() => socket.emit('devDrawCards', { roomId, count: 3 })}>
                Взяти 3 карти
              </button>
              
              <button onClick={() => socket.emit('devSetMyTurn', { roomId })}>
                Зробити мій хід
              </button>
            </>
          )}
        </div>

        {/* AuthModal for non-authenticated users */}
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => {
            // Redirect to home if user cancels authentication
            navigate('/');
          }} 
          onSuccess={handleAuthSuccess}
        />
        
        {/* FORTUNO Button */}
        <FortunoButton 
          isVisible={isFortunoVisible} 
          onFortunoClick={handleFortunoClick} 
        />

        {/* Game End Modal */}
        {showGameEndModal && (
          <GameEndModal 
            winner={gameWinner}
            message={gameEndMessage}
            onReturnHome={() => {
              // Clear game state
              localStorage.removeItem('inGameState');
              localStorage.removeItem('currentRoomId');
              // Navigate to home
              navigate('/');
            }}
          />
        )}

        {/* Game Chat */}
        {gameStarted && (
          <GameChat
            socket={socket}
            roomId={roomId}
            username={user?.username}
            isExpanded={isChatExpanded}
          />
        )}

      </div>
    </ErrorBoundary>
  );
}