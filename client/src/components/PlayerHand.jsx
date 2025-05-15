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
        outline: `4px solid ${outlineColor}`,
        outlineOffset: '2px',
        borderRadius: '12px'
      };
    }
    
    return {};
  };

  // Визначення стилю для карти в залежності від можливості зіграти
  const getCardStyle = (index) => {
    let style = {};
    
    // Базовий стиль
    style.transform = `rotate(${-10 + (index * (20 / (hand.length > 1 ? hand.length - 1 : 1)))}deg)`;
    style.transformOrigin = 'bottom center';
    style.cursor = isCurrentPlayerTurn ? "pointer" : "not-allowed";
    
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
                ? onPlayCard(index, true) // Передаємо true для скидання карти
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