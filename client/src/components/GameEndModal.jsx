import React from 'react';
import './GameEndModal.css';

const GameEndModal = ({ winner, message, onReturnHome }) => {
  return (
    <div className="modal-overlay">
      <div className="game-end-modal">
        <h2>Гра завершена!</h2>
        <div className="winner-message">
          🎉 {message} 🎉
        </div>
        <button className="return-home-btn" onClick={onReturnHome}>
          Повернутися на головну
        </button>
      </div>
    </div>
  );
};

export default GameEndModal; 