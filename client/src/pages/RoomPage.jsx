import React, { useEffect, useState, Component } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../socket";

// Імпортуємо компоненти
import GameTable from "../components/GameTable";
import GameHeader from "../components/GameHeader";
import CardDeck from "../components/CardDeck";
import PlayerHand from "../components/PlayerHand";
import OpponentView from "../components/OpponentView";
import ColorPicker from "../components/ColorPicker";
import DiceRoller from "../components/DiceRoller";

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

  // Перше завантаження - примусове оновлення через 1 секунду
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoaded(true);
      console.log('Сторінка повністю завантажена');
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    console.log(`Joining room: ${roomId}`);
    socket.emit('joinRoom', roomId);
    
    socket.on('connect', () => {
      console.log('Connected to server, socket ID:', socket.id);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });

    socket.on('playerJoined', (data) => {
      console.log('Players in room:', data.players);
      setPlayers(data.players);
    });

    socket.on('handDealt', ({ hand, discardTop }) => {
      setHand(hand);
      setCurrentCard(discardTop);
    });

    socket.on('updateHandAndDiscard', ({ hand, discardTop }) => {
      setHand(hand);
      setCurrentCard(discardTop);
    });

    socket.on('turnChanged', ({ currentPlayerId }) => {
      setCurrentPlayerId(currentPlayerId);
      // При зміні ходу ховаємо пікер, якщо він був відкритий
      setShowColorPicker(false);
      setPendingBlackCard(null);
      // Ховаємо будь-які повідомлення про блокування
      setActionBlockedMessage("");
    });

    socket.on('gameStarted', ({ discardTop, players }) => {
      setCurrentCard(discardTop);
      setPlayers(players);
      setGameStarted(true); // Гра почалася — вимикаємо кнопку
    });

    socket.on('updatePlayers', ({ players }) => {
      setPlayers(players);
    });

    // Додаємо обробник події кидання кубика Фортуно
    socket.on('fortunoDiceRolled', ({ diceResult, playerId }) => {
      // Зберігаємо результат кубика
      setDiceResult(diceResult);
      // Показуємо кубик усім гравцям
      setShowDiceRoller(true);
    });

    // Додаємо обробник події вибору картини для скидання
    socket.on('chooseCardToDiscard', () => {
      setChooseCardToDiscard(true);
    });

    // Обробник блокування дій
    socket.on('actionBlocked', ({ message }) => {
      setActionBlockedMessage(message);
      
      // Автоматично ховаємо повідомлення через 3 секунди
      setTimeout(() => {
        setActionBlockedMessage("");
      }, 3000);
    });

    // Обробник пропуску ходу
    socket.on('turnSkipped', ({ skippedPlayerId, currentPlayerId }) => {
      // Показуємо повідомлення про пропуск ходу
      const isCurrentUser = skippedPlayerId === socket.id;
      const message = isCurrentUser 
        ? "Ви пропускаєте свій хід через карту Фортуно" 
        : "Гравець пропускає свій хід через карту Фортуно";
      
      setTurnSkippedMessage(message);
      
      // Ховаємо повідомлення через 3 секунди
      setTimeout(() => {
        setTurnSkippedMessage("");
      }, 3000);
    });

    // Додати після всіх обробників подій в useEffect
    socket.on('error', (error) => {
      console.error('Socket IO error:', error);
      setActionBlockedMessage(`Помилка з'єднання: ${error.message || 'Невідома помилка'}`);
      
      // Ховаємо повідомлення через 5 секунд
      setTimeout(() => {
        setActionBlockedMessage("");
      }, 5000);
    });
    
    socket.on('connect_failed', () => {
      console.error('Socket IO connection failed');
      setActionBlockedMessage("Не вдалося підключитися до сервера");
      
      // Ховаємо повідомлення через 5 секунд
      setTimeout(() => {
        setActionBlockedMessage("");
      }, 5000);
    });

    return () => {
      console.log(`Leaving room: ${roomId}`);
      socket.emit('leaveRoom', roomId);
      socket.off('connect');
      socket.off('connect_error');
      socket.off('error');
      socket.off('connect_failed');
      socket.off('playerJoined');
      socket.off('handDealt');
      socket.off('updateHandAndDiscard');
      socket.off('turnChanged');
      socket.off('gameStarted');
      socket.off('updatePlayers');
      socket.off('fortunoDiceRolled');
      socket.off('chooseCardToDiscard');
      socket.off('actionBlocked');
      socket.off('turnSkipped');
    };
  }, [roomId]);

  // Додати ефект для перевірки існування кімнати
  useEffect(() => {
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
        }
      } catch (err) {
        console.error('Помилка перевірки кімнати:', err);
        setActionBlockedMessage('Помилка з\'єднання з сервером');
      }
    };
    
    checkRoomExists();
  }, [roomId]);

  // Кнопка для старту гри
  const handleStartGame = () => {
    socket.emit('startGame', roomId);
    setGameStarted(true); // Вимикаємо кнопку одразу після натискання
  };

  // Клік по картці для викладання або скидання
  const handlePlayCard = (cardOrIndex, isDiscard = false) => {
    if (currentPlayerId !== socket.id) return;
    
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
    if (currentPlayerId !== socket.id) return;
    socket.emit('drawCard', { roomId });
  };

  // Фільтруємо опонентів (всі гравці, крім поточного)
  const opponents = players.filter(p => p.id !== socket.id);

  // Функція для розгортання/згортання панелі розробника
  const toggleDevPanel = () => {
    setDevPanelExpanded(!devPanelExpanded);
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

  return (
    <ErrorBoundary>
      <div className="game-page">
        {/* Шапка гри */}
        <ErrorBoundary>
          <GameHeader 
            roomId={roomId}
            playersCount={players.length}
            isCurrentPlayerTurn={currentPlayerId === socket.id}
            actionBlockedMessage={actionBlockedMessage}
            turnSkippedMessage={turnSkippedMessage}
            onStartGame={handleStartGame}
            isGameStarted={gameStarted}
          />
        </ErrorBoundary>
        
        {/* Ігровий стіл */}
        <div className="game-area">
          {/* Опоненти — позиціонуються абсолютно відносно game-area */}
          {opponents.map((player, index) => (
            <ErrorBoundary key={`opponent-boundary-${index}`}>
              <OpponentView 
                key={player.id || `opponent-${index}`}
                player={player || {}}
                position={index + 1}
                isCurrentTurn={currentPlayerId === (player && player.id)}
                totalPlayers={players.length}
              />
            </ErrorBoundary>
          ))}

          {/* Рука гравця — абсолютне позиціонування в game-area */}
          <ErrorBoundary>
            <PlayerHand 
              hand={hand} 
              isCurrentPlayerTurn={currentPlayerId === socket.id}
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
                isCurrentPlayerTurn={currentPlayerId === socket.id}
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
      </div>
    </ErrorBoundary>
  );
}