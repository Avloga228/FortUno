import React from "react";
import "./OpponentView.css";

const OpponentView = ({ player, position, isCurrentTurn, totalPlayers }) => {
  // Визначення класу позиції опонента на основі загальної кількості гравців
  const getPositionClass = () => {
    // За замовчуванням (якщо не передано позицію)
    if (!position) {
      return "opponent-top";
    }
    
    // Для випадку, коли є 1 опонент
    if (totalPlayers === 2) {
      return "opponent-top";
    }
    
    // Для випадку, коли є 2 опоненти
    if (totalPlayers === 3) {
      return position === 1 ? "opponent-left" : "opponent-right";
    }
    
    // Для випадку, коли є 3 опоненти
    if (totalPlayers === 4) {
      if (position === 1) return "opponent-left";
      if (position === 2) return "opponent-top";
      if (position === 3) return "opponent-right";
    }
    
    return "opponent-top"; // За замовчуванням
  };

  // Перевірка, чи це хід опонента
  const isPlayerTurn = isCurrentTurn === player.id;
  
  // Визначаємо кількість карт для відображення (максимум 10)
  const cardCount = Math.min(player.handSize || 0, 10);
  
  // Створюємо масив карт для відображення
  const cardsArray = Array.from({ length: cardCount });

  return (
    <div className={`opponent-container ${getPositionClass()} ${isPlayerTurn ? 'current-turn' : ''}`}>
      <div className="opponent-avatar">
        {isPlayerTurn ? "👤🔄" : "👤"}
      </div>
      
      <div className="opponent-info">
        <div className="opponent-name">
          {player.name || (player.id && typeof player.id === 'string' 
            ? `Гравець ${player.id.substring(0, 4)}` 
            : `Гравець ${position}`)}
        </div>
        <div className="opponent-cards-count">
          {player.handSize || 0} карт
        </div>
      </div>
      
      <div className="opponent-cards">
        {cardsArray.map((_, index) => (
          <div 
            key={index} 
            className="opponent-card"
            style={{
              transform: `rotate(${-5 + (index * (10 / (cardCount > 1 ? cardCount - 1 : 1)))}deg)`,
              left: `${index * 12}px`
            }}
          >
            <div className="card-back"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OpponentView; 