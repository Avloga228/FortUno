import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../socket";
import ColorPicker from "../components/ColorPicker";
import "./RoomPage.css";

export default function RoomPage() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [hand, setHand] = useState([]);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingBlackCard, setPendingBlackCard] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    socket.emit('joinRoom', roomId);

    socket.on('playerJoined', (data) => {
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
    });

    socket.on('gameStarted', ({ discardTop, players }) => {
      setCurrentCard(discardTop);
      setPlayers(players);
      setGameStarted(true); // Гра почалася — вимикаємо кнопку
    });

    return () => {
      socket.emit('leaveRoom', roomId);
      socket.off('playerJoined');
      socket.off('handDealt');
      socket.off('updateHandAndDiscard');
      socket.off('turnChanged');
      socket.off('gameStarted');
    };
  }, [roomId]);

  // Кнопка для старту гри (можна зробити доступною лише хосту)
  const handleStartGame = () => {
    socket.emit('startGame', roomId);
    setGameStarted(true); // Вимикаємо кнопку одразу після натискання
  };

  // Клік по картці для викладання
  const handlePlayCard = (card) => {
    if (currentPlayerId !== socket.id) return;
    if (card.color === "black") {
      setShowColorPicker(true);
      setPendingBlackCard(card);
    } else {
      socket.emit('playCard', { roomId, card });
    }
  };

  // Вибір кольору для чорної карти
  const handleColorPick = (color) => {
    setShowColorPicker(false);
    if (pendingBlackCard) {
      socket.emit('playCard', { roomId, card: { ...pendingBlackCard, chosenColor: color } });
      setPendingBlackCard(null);
    }
  };

  // Взяти карту з колоди
  const handleDrawCard = () => {
    if (currentPlayerId !== socket.id) return;
    socket.emit('drawCard', { roomId });
  };

  // Відображення кольору картки для класу
  const getCardClass = (card) => {
    if (!card) return "card";
    let colorClass = "";
    switch (card.color) {
      case "red": colorClass = "red"; break;
      case "yellow": colorClass = "yellow"; break;
      case "green": colorClass = "green"; break;
      case "blue": colorClass = "blue"; break;
      case "purple": colorClass = "purple"; break;
      case "black": colorClass = "black"; break;
      default: colorClass = "";
    }
    return `card playable ${colorClass}`;
  };

  // Додаю функцію для отримання шляху до зображення картки
  const getCardImage = (card) => {
    if (!card) return null;
    let value = String(card.value).toLowerCase();
    // Українські назви для спеціальних карт
    if (value === 'обертання ходу') value = 'reverse';
    if (value === 'пропуск ходу') value = 'skip';
    if (value === '+3 карти') value = 'plus_3';
    if (value === '+5 карт') value = 'plus_5';
    if (value === 'фортуно') value = 'fortuno';
    // Для спеціальних карток (англійські варіанти)
    if (value === '+3' || value === 'plus_3') value = 'plus_3';
    if (value === '+5' || value === 'plus_5') value = 'plus_5';
    if (value === 'wild' || value === 'fortuno') value = 'fortuno';
    if (value === 'skip') value = 'skip';
    if (value === 'reverse') value = 'reverse';
    if (
      card && card.color === 'black' &&
      !['фортуно', 'fortuno', 'plus_5', '+5', '+5 карт'].includes(String(card.value).toLowerCase())
    ) {
      console.log('DEBUG +3 VALUE:', card.value, card);
    }
    return `/img/${card.color}/card_${card.color}_${value}.webp`;
  };

  // Dev-панель для видачі карт
  const devCards = [
    { value: 'ФортУно', color: 'black' },
    { value: '+3 карти', color: 'black' },
    { value: '+5 карт', color: 'black' },
    { value: 'Пропуск ходу', color: 'red' },
    { value: 'Обертання ходу', color: 'red' },
    ...[1,2,3,4,5,6,7,8,9].map(n => ({ value: String(n), color: 'red' }))
  ];
  const handleDevGiveCard = (card) => {
    socket.emit('devGiveCard', { roomId, value: card.value, color: card.color });
  };

  return (
    <div className="game-bg">
      <div className="dev-panel">
        {devCards.map((card, idx) => (
          <button key={idx} onClick={() => handleDevGiveCard(card)}>
            {card.value}
          </button>
        ))}
      </div>
      <div className="game-container">
        <div className="header">
          <h1>
            Кімната: <span className="room-id">{roomId}</span>
          </h1>
          <div className="players-count">Гравців: {players.length}/4</div>
          <div>
            {currentPlayerId === socket.id
              ? <span style={{ color: "green" }}>Ваш хід!</span>
              : <span style={{ color: "red" }}>Хід суперника</span>
            }
          </div>
          <button 
            onClick={handleStartGame} 
            disabled={gameStarted || players.length < 2}
          >
            Старт гри
          </button>
        </div>

        <div className="game-table">
          {/* Центральна область */}
          <div className="central-area">
            <div className="deck">
              <div
                className="card back"
                onClick={currentPlayerId === socket.id ? handleDrawCard : undefined}
                style={{ cursor: currentPlayerId === socket.id ? "pointer" : "not-allowed" }}
                title={currentPlayerId === socket.id ? "Взяти карту" : "Зачекайте свого ходу"}
              >?</div>
              <div className="deck-label">Колода</div>
            </div>
            <div className="discard-pile">
              <div
                className={getCardClass(currentCard)}
              >
                {currentCard ? (
                  <img
                    src={getCardImage(currentCard)}
                    alt={`${currentCard.value} ${currentCard.color}`}
                    style={{
                      width: 80,
                      height: 120,
                      objectFit: 'contain',
                      outline:
                        (() => {
                          const val = String(currentCard.value).toLowerCase().trim();
                          const match = [
                            'фортуно', 'fortuno', 'plus_3', '+3', '+3 карти', '3', '3 карти',
                            'plus_5', '+5', '+5 карт'
                          ].includes(val);
                          if (match && currentCard.chosenColor) {
                            console.log('OBVODKA DEBUG:', val, currentCard);
                            return `4px solid ${
                              currentCard.chosenColor === 'red' ? '#ff6f61' :
                              currentCard.chosenColor === 'yellow' ? '#ffe066' :
                              currentCard.chosenColor === 'green' ? '#43cea2' :
                              currentCard.chosenColor === 'blue' ? '#185a9d' :
                              currentCard.chosenColor === 'purple' ? '#a259c4' :
                              '#000'
                            }`;
                          }
                          return undefined;
                        })(),
                      outlineOffset:
                        (() => {
                          const val = String(currentCard.value).toLowerCase().trim();
                          const match = [
                            'фортуно', 'fortuno', 'plus_3', '+3', '+3 карти', '3', '3 карти',
                            'plus_5', '+5', '+5 карт'
                          ].includes(val);
                          if (match && currentCard.chosenColor) {
                            return '2px';
                          }
                          return undefined;
                        })(),
                      borderRadius: '12px',
                    }}
                    onError={e => { e.target.onerror = null; e.target.src = '/img/card_placeholder.webp'; }}
                  />
                ) : ""}
              </div>
              <div className="deck-label">Скидання</div>
            </div>
          </div>

          {/* Гравець знизу (поточний) */}
          <div className="current-player">
            <div className="hand">
              {hand.map((card, index) => (
                <div
                  key={index}
                  className={getCardClass(card)}
                  onClick={() => handlePlayCard(card)}
                  style={{
                    cursor: currentPlayerId === socket.id ? "pointer" : "not-allowed"
                  }}
                  title={currentPlayerId === socket.id ? "Викласти карту" : "Зачекайте свого ходу"}
                >
                  <img
                    src={getCardImage(card)}
                    alt={`${card.value} ${card.color}`}
                    style={{
                      width: 80,
                      height: 120,
                      objectFit: 'contain',
                      outline:
                        (String(card.value).toLowerCase() === 'фортуно' || String(card.value).toLowerCase() === 'fortuno') && card.chosenColor
                          ? `4px solid ${
                              card.chosenColor === 'red' ? '#ff6f61' :
                              card.chosenColor === 'yellow' ? '#ffe066' :
                              card.chosenColor === 'green' ? '#43cea2' :
                              card.chosenColor === 'blue' ? '#185a9d' :
                              card.chosenColor === 'purple' ? '#a259c4' :
                              '#000'
                            }`
                          : undefined,
                      outlineOffset:
                        (String(card.value).toLowerCase() === 'фортуно' || String(card.value).toLowerCase() === 'fortuno') && card.chosenColor
                          ? '2px'
                          : undefined,
                      borderRadius: '12px',
                    }}
                    onError={e => { e.target.onerror = null; e.target.src = '/img/card_placeholder.webp'; }}
                  />
                </div>
              ))}
            </div>
            <div className="player-label">Ваша рука</div>
          </div>
        </div>

        {/* Модальне вікно вибору кольору для чорної карти */}
        {showColorPicker && (
          <div className="color-picker-modal" style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <ColorPicker onPick={handleColorPick} />
          </div>
        )}
      </div>
    </div>
  );
}