// RoomPage.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../socket";
import "./RoomPage.css";

export default function RoomPage() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [currentCard, setCurrentCard] = useState("+2");
  const [hand, setHand] = useState(["6", "9", "2", "🔄", "🎨"]);

  useEffect(() => {
    socket.emit('joinRoom', roomId);

    socket.on('playerJoined', (data) => {
      setPlayers(data.players);
    });

    return () => {
      socket.emit('leaveRoom', roomId);
      socket.off('playerJoined');
    };
  }, [roomId]);

  return (
    <div className="game-bg">
      <div className="game-container">
        <div className="header">
          <h1>Кімната: <span className="room-id">{roomId}</span></h1>
          <div className="players-count">Гравців: {players.length}/4</div>
        </div>

        <div className="game-table">
          {/* Верхній суперник */}
          <div className="opponent opponent-top">
            <div className="player-avatar">👤</div>
            <div className="player-name">Player 2</div>
            <div className="cards-stack">6 карт</div>
          </div>

          {/* Лівий суперник */}
          <div className="opponent opponent-left">
            <div className="player-avatar">👤</div>
            <div className="player-name">Player 3</div>
            <div className="cards-stack">2 карти</div>
          </div>

          {/* Правий суперник */}
          <div className="opponent opponent-right">
            <div className="player-avatar">👤</div>
            <div className="player-name">Player 4</div>
            <div className="cards-stack">7 карт</div>
          </div>

          {/* Центральна область */}
          <div className="central-area">
            <div className="deck">
              <div className="card back">?</div>
              <div className="deck-label">Колода</div>
            </div>
            <div className="discard-pile">
              <div className="card red">{currentCard}</div>
              <div className="deck-label">Скидання</div>
            </div>
          </div>

          {/* Гравець знизу (поточний) */}
          <div className="current-player">
            <div className="hand">
              {hand.map((card, index) => (
                <div key={index} className="card playable">
                  {card}
                </div>
              ))}
            </div>
            <div className="player-label">Ваша рука</div>
          </div>
        </div>
      </div>
    </div>
  );
}