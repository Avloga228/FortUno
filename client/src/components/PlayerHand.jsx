import React from "react";
import "./PlayerHand.css";

const PlayerHand = ({ 
  hand, 
  isCurrentPlayerTurn, 
  onPlayCard, 
  chooseCardToDiscard 
}) => {
  // Отримання шляху до зображення картки
  const getCardImage = (card) => {
    if (!card) return "/img/card_placeholder.webp";
    
    let value = String(card.value).toLowerCase();
    // Українські назви для спеціальних карт
    if (value === 'обертання ходу') value = 'reverse';
    if (value === 'пропуск ходу') value = 'skip';
    if (value === '+3 картини') value = 'plus_3';
    if (value === '+5 карт') value = 'plus_5';
    if (value === 'фортуно') value = 'fortuno';
    
    // Для спеціальних карток
    if (value === '+3' || value === 'plus_3') value = 'plus_3';
    if (value === '+5' || value === 'plus_5') value = 'plus_5';
    if (value === 'wild' || value === 'fortuno') value = 'fortuno';
    if (value === 'skip') value = 'skip';
    if (value === 'reverse') value = 'reverse';
    
    return `/img/${card.color}/card_${card.color}_${value}.webp`;
  };

  // Обчислення стилю обведення для карт Фортуно
  const getFortunoOutlineStyle = (card) => {
    if (!card || !card.chosenColor) return {};
    
    const val = String(card.value).toLowerCase().trim();
    const isFortunoCard = val === 'фортуно' || val === 'fortuno';
    
    if (isFortunoCard) {
      let outlineColor;
      switch (card.chosenColor) {
        case 'red': outlineColor = '#ff6f61'; break;
        case 'yellow': outlineColor = '#ffe066'; break;
        case 'green': outlineColor = '#43cea2'; break;
        case 'blue': outlineColor = '#185a9d'; break;
        case 'purple': outlineColor = '#a259c4'; break;
        default: outlineColor = '#000';
      }
      
      return {
        boxShadow: `0 0 8px 3px ${outlineColor}`,
        border: `2px solid ${outlineColor}`
      };
    }
    
    return {};
  };

  // Визначення стилю для карти в залежності від кількості карт і позиції
  const getCardStyle = (index) => {
    let style = {};
    
    // Обчислюємо розподіл карт у руці
    const totalCards = hand.length;
    
    // Обчислюємо кут розвороту в залежності від кількості карт
    const maxFanAngle = Math.min(36, totalCards * 3); // Плавне збільшення кута віяла
    const angle = -maxFanAngle/2 + (index * (maxFanAngle / (totalCards > 1 ? totalCards - 1 : 1)));
    
    // Визначаємо, чи є екран мобільним
    const isMobile = window.innerWidth <= 768;
    
    // Адаптивне накладання карт в залежності від їх кількості
    const cardWidth = isMobile ? 90 : 110; // Ширина карти в пікселях залежно від розміру екрану
    
    // Плавне збільшення накладання в залежності від кількості карт
    // Формула: починаємо з мінімального накладання і зменшуємо відстань при збільшенні карт
    const minOverlap = 0.75; // Зменшуємо перекриття між картами для кращої видимості карт
    const maxOverlap = 0.4; // Збільшуємо максимальне перекриття для збереження компактності
    
    // Лінійне зменшення від minOverlap до maxOverlap залежно від кількості карт
    // Для 1-3 карт - майже без накладання, для 8+ карт - максимальне накладання
    const overlappingFactor = Math.max(
      maxOverlap, 
      minOverlap - (totalCards - 3) * (minOverlap - maxOverlap) / 5
    );
    
    // Обчислюємо загальну ширину віяла карт з урахуванням накладання
    const totalWidth = cardWidth + (totalCards - 1) * cardWidth * overlappingFactor;
    
    // Позиція першої карти (щоб центрувати все віяло)
    const startPosition = -totalWidth / 2 + cardWidth / 2;
    
    // Динамічний зсув вліво для кращого центрування
    // Чим більше карт, тим менший зсув потрібен
    const offsetLeft = Math.max(0, 45 - totalCards * 3);
    
    // Позиція кожної карти
    const cardPosition = startPosition + index * cardWidth * overlappingFactor;
    
    // Базовий стиль з ефектом віяла та адаптивним накладанням
    style.transform = `rotate(${angle}deg)`;
    style.transformOrigin = 'bottom center';
    style.left = `calc(50% + ${cardPosition - offsetLeft}px)`; // Динамічний зсув вліво
    style.position = 'absolute';
    
    // Стиль для активної карти (наведення або можливість скинути)
    if (chooseCardToDiscard) {
      style.border = "3px dashed red";
    }
    
    return style;
  };

  return (
    <div className="player-hand-container">
      <div className="cards-container">
        {hand.map((card, index) => (
          <div
            key={index}
            className={`player-card ${isCurrentPlayerTurn ? 'playable' : ''}`}
            onClick={() => 
              isCurrentPlayerTurn && 
              (chooseCardToDiscard 
                ? onPlayCard(index, true) // Передаємо true для скидання картини
                : onPlayCard(card, false)) // Передаємо false для звичайного ходу
            }
            style={getCardStyle(index)}
          >
            <img
              src={getCardImage(card)}
              alt={`${card.value} ${card.color}`}
              style={getFortunoOutlineStyle(card)}
              onError={(e) => { e.target.onerror = null; e.target.src = '/img/card_placeholder.webp'; }}
            />
          </div>
        ))}
      </div>
      <div className="player-hand-label">
        {chooseCardToDiscard && isCurrentPlayerTurn 
          ? "Виберіть карту для скидання" 
          : "Ваша рука"}
      </div>
    </div>
  );
};

export default PlayerHand; 