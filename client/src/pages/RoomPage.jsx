import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../socket";
import ColorPicker from "../components/ColorPicker";
import DiceRoller from "../components/DiceRoller";
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
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [chooseCardToDiscard, setChooseCardToDiscard] = useState(false);
  const [actionBlockedMessage, setActionBlockedMessage] = useState("");
  const [diceResult, setDiceResult] = useState(null);
  const [turnSkippedMessage, setTurnSkippedMessage] = useState("");

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

    return () => {
      socket.emit('leaveRoom', roomId);
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
    // Компонент сам ховає результат через 5 секунд (див. DiceRoller.jsx)
    // і викликає callback, після чого ми закриваємо модальне вікно
    setTimeout(() => {
      setShowDiceRoller(false);
    }, 5000); // Закриваємо модальне вікно через 5 секунд після завершення анімації
  };

  // Обробка завершення анімації кубика - повідомляємо сервер
  const handleDiceFinished = (result) => {
    socket.emit('fortunoDiceFinished', { roomId });
  };

  // Вибір картини для скидання
  const handleDiscardCard = (index) => {
    if (chooseCardToDiscard && currentPlayerId === socket.id) {
      socket.emit('discardCard', { roomId, cardIndex: index });
      setChooseCardToDiscard(false);
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
    if (value === '+3 картини') value = 'plus_3';
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
    { value: '+3 картини', color: 'black' },
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
          {actionBlockedMessage && (
            <div className="action-blocked-message" style={{ color: "red", fontWeight: "bold" }}>
              {actionBlockedMessage}
            </div>
          )}
          {turnSkippedMessage && (
            <div className="turn-skipped-message" style={{ color: "orange", fontWeight: "bold" }}>
              {turnSkippedMessage}
            </div>
          )}
          <button 
            onClick={handleStartGame} 
            disabled={gameStarted || players.length < 2}
          >
            Старт гри
          </button>
        </div>

        <div className="game-table">
          {/* Опоненти */}
          {(() => {
            const opponents = players.filter(p => p.id !== socket.id);
            const positions = [
              'opponent-top',
              'opponent-left',
              'opponent-right'
            ];
            return opponents.map((player, idx) => {
              let posClass = '';
              if (opponents.length === 1) posClass = 'opponent-top';
              if (opponents.length === 2) posClass = idx === 0 ? 'opponent-top' : 'opponent-left';
              if (opponents.length === 3) posClass = positions[idx];
              return (
                <div key={player.id} className={`opponent ${posClass}`}>
                  <div className="player-avatar">👤</div>
                  <div className="player-name">{player.name || `Гравець`}</div>
                  <div className="hand" style={{flexDirection: 'row', gap: 6}}>
                    {Array.from({length: player.handSize ?? 0}).map((_, i) => (
                      <div key={i} className="card" style={{background:'#111', border:'2px solid #222', width: 40, height: 60}} />
                    ))}
                  </div>
                  <div className="cards-stack">{player.handSize ?? 0} карт</div>
                </div>
              );
            });
          })()}
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
                            'фортуно', 'fortuno', 'plus_3', '+3', '+3 картини', '3', '3 картини',
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
                            'фортуно', 'fortuno', 'plus_3', '+3', '+3 картини', '3', '3 картини',
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
                  onClick={() => chooseCardToDiscard ? handleDiscardCard(index) : handlePlayCard(card)}
                  style={{
                    cursor: currentPlayerId === socket.id ? "pointer" : "not-allowed",
                    border: chooseCardToDiscard && currentPlayerId === socket.id ? "3px dashed red" : undefined
                  }}
                  title={
                    chooseCardToDiscard && currentPlayerId === socket.id 
                    ? "Виберіть карту для скидання" 
                    : currentPlayerId === socket.id ? "Викласти карту" : "Зачекайте свого ходу"
                  }
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
            <div className="player-label">
              {chooseCardToDiscard && currentPlayerId === socket.id 
                ? "Виберіть карту для скидання" 
                : "Ваша рука"}
            </div>
          </div>
        </div>

        {/* Модальне вікно вибору кольору для чорної картини */}
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

        {/* Модальне вікно з кубиком для карти Фортуно */}
        {showDiceRoller && (
          <div className="dice-roller-modal" style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <DiceRoller 
              onResult={handleDiceResult} 
              serverDiceResult={diceResult} 
              onFinished={handleDiceFinished} 
            />
          </div>
        )}
      </div>
    </div>
  );
}