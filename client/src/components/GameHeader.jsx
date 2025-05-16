import React from "react";
import "./GameHeader.css";

const GameHeader = ({ 
  roomId, 
  playersCount, 
  isCurrentPlayerTurn, 
  actionBlockedMessage, 
  turnSkippedMessage,
  onLeaveGame
}) => {
  return (
    <div className="game-header">
      <div className="header-left">
        <h1 className="room-title">
          FortUno <span className="room-id">{roomId}</span>
        </h1>
      </div>
      
      <div className="header-center">
        {actionBlockedMessage && (
          <div className="action-blocked-message">
            {actionBlockedMessage}
          </div>
        )}
        {turnSkippedMessage && (
          <div className="turn-skipped-message">
            {turnSkippedMessage}
          </div>
        )}
      </div>
      
      <div className="header-right">
        <div className="players-count">
          Гравців: {playersCount}/4
        </div>
        
        <div className="turn-status">
          {isCurrentPlayerTurn
            ? <span className="your-turn">Ваш хід!</span>
            : <span className="opponent-turn">Хід суперника</span>
          }
        </div>
        
        <button 
          className="leave-game-btn"
          onClick={onLeaveGame}
        >
          Вийти з гри
        </button>
      </div>
    </div>
  );
};

export default GameHeader; 