import React from "react";
import "./OpponentView.css";

const OpponentView = ({ player, position, isCurrentTurn, totalPlayers }) => {
  // Safety check for invalid player data
  if (!player || !player.id) {
    console.warn("Invalid player data in OpponentView");
    return null; // Don't render anything for invalid players
  }

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
  
  // Визначаємо кількість карт для відображення (максимум 20)
  const cardCount = Math.min(player.handSize || 0, 20);
  
  // Створюємо масив карт для відображення
  const cardsArray = Array.from({ length: cardCount });
  
  // Отримуємо позицію опонента
  const positionClass = getPositionClass();
  
  // Розрахунок стилів для карт опонента
  const getCardStyle = (index) => {
    // Базові параметри розрахунку
    const totalCards = cardCount;
    
    // Обчислюємо кут розвороту в залежності від кількості карт
    const maxFanAngle = Math.min(40, totalCards * 3); // Плавне збільшення кута віяла
    
    // Зміщення карт і накладання
    const cardWidth = 110; // Такий же розмір як у карт гравця
    const cardHeight = 165;
    
    // Плавне збільшення накладання в залежності від кількості карт
    const minOverlap = 0.75; // Зменшуємо перекриття для кращої видимості карт
    const maxOverlap = 0.4; // Збільшуємо максимальне перекриття для компактності
    
    // Лінійне зменшення від minOverlap до maxOverlap залежно від кількості карт
    const overlappingFactor = Math.max(
      maxOverlap, 
      minOverlap - (totalCards - 3) * (minOverlap - maxOverlap) / 5
    );
    
    // Обчислюємо загальну ширину віяла
    const totalWidth = cardWidth + (totalCards - 1) * cardWidth * overlappingFactor;
    
    // Початкова позиція (щоб центрувати віяло)
    const startPosition = -totalWidth / 2 + cardWidth / 2;
    
    // Позиція кожної карти
    const cardPosition = startPosition + index * cardWidth * overlappingFactor;
    
    let style = {};
    let angle = -maxFanAngle/2 + (index * (maxFanAngle / (totalCards > 1 ? totalCards - 1 : 1)));
    
    // Застосовуємо різні стилі в залежності від позиції опонента
    switch (positionClass) {
      case 'opponent-top':
        // Карти опонента зверху (перевернуті на 180° з фокусом зверху)
        style = {
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
          transform: `rotate(${180 - angle}deg)`,
          transformOrigin: 'center top',
          left: `${cardPosition}px`,
          top: '0px',
        };
        break;
        
      case 'opponent-left':
        // Карти опонента зліва (з фокусом зліва і розходяться вправо)
        style = {
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
          transform: `rotate(${90 + angle}deg)`, // + angle щоб картини розкривались вправо
          transformOrigin: 'left center', // Точка фокусу зліва
          left: '0px',
          // Вертикальне центрування - забезпечуємо, що картини розходяться рівномірно вверх і вниз
          top: `calc(50% - ${cardHeight / 2}px + ${cardPosition * 0.8}px)`,
        };
        break;
        
      case 'opponent-right':
        // Карти опонента справа (з фокусом справа і розходяться вліво)
        style = {
          width: `${cardWidth}px`,
          height: `${cardHeight}px`,
          transform: `rotate(${-90 - angle}deg)`, // - angle щоб картини розкривались вліво
          transformOrigin: 'right center', // Точка фокусу справа
          right: '0px',
          // Вертикальне центрування - забезпечуємо, що картини розходяться рівномірно вверх і вниз
          top: `calc(50% - ${cardHeight / 2}px + ${cardPosition * 0.8}px)`,
        };
        break;
        
      default:
        break;
    }
    
    // Додаємо базові стилі
    style.position = 'absolute';
    style.backgroundSize = 'contain';
    style.backgroundColor = '#000';
    style.borderRadius = '10px';
    style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    
    return style;
  };

  return (
    <div className={`opponent-container ${positionClass} ${isPlayerTurn ? 'current-turn' : ''}`}>
      <div className="opponent-avatar">
        {isPlayerTurn ? "👤🔄" : "👤"}
      </div>
      
      <div className="opponent-info">
        <div className="opponent-name">
          {player.name || (player.id && typeof player.id === 'string' 
            ? `Гравець ${player.id}` 
            : `Гравець ${position}`)}
        </div>
        <div className="opponent-cards-count">
          {player.handSize || 0} карт
        </div>
      </div>
      
      <div className={`opponent-cards ${positionClass}-cards`}>
        {cardsArray.map((_, index) => (
          <div 
            key={index} 
            className="opponent-card"
            style={getCardStyle(index)}
          >
            <img 
              src="/img/back/card_back.webp" 
              alt="Карта опонента"
              className="card-back-img"
              style={{width: '100%', height: '100%', objectFit: 'contain'}}
              onError={(e) => { e.target.onerror = null; e.target.src = '/img/card_placeholder.webp'; }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default OpponentView; 