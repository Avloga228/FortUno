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

  return (
    <div className="game-bg">
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
              <div className={getCardClass(currentCard)}>
                {currentCard ? `${currentCard.value} (${currentCard.color})` : ""}
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
                    cursor: currentPlayerId === socket.id ? "pointer" : "not-allowed",
                    opacity: currentPlayerId === socket.id ? 1 : 0.6
                  }}
                  title={currentPlayerId === socket.id ? "Викласти карту" : "Зачекайте свого ходу"}
                >
                  {card.value} ({card.color})
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