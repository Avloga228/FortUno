import React from "react";
import "./CardDeck.css";

// Компонент для відображення колоди карт та стопки скидання
const CardDeck = ({ currentCard, onDrawCard, isCurrentPlayerTurn }) => {
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
    const isSpecialCard = [
      'фортуно', 'fortuno', 'plus_3', '+3', '+3 картини', '3', '3 картини',
      'plus_5', '+5', '+5 карт'
    ].includes(val);
    
    if (isSpecialCard) {
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

  return (
    <div className="card-deck-container">
      <div className="deck">
        <div
          className="card deck-pile"
          onClick={isCurrentPlayerTurn ? onDrawCard : undefined}
          style={{ cursor: isCurrentPlayerTurn ? "pointer" : "not-allowed" }}
        >
          <div className="deck-top">
            <img 
              src="/img/card_back.webp" 
              alt="Колода"
              onError={(e) => { e.target.onerror = null; e.target.src = '/img/card_placeholder.webp'; }}
            />
          </div>
        </div>
        <div className="deck-label">Колода</div>
      </div>
      
      <div className="discard">
        <div className="card discard-pile">
          {currentCard ? (
            <img
              src={getCardImage(currentCard)}
              alt={`${currentCard.value} ${currentCard.color}`}
              style={getFortunoOutlineStyle(currentCard)}
              onError={(e) => { e.target.onerror = null; e.target.src = '/img/card_placeholder.webp'; }}
            />
          ) : (
            <div className="empty-discard"></div>
          )}
        </div>
        <div className="deck-label">Скидання</div>
      </div>
    </div>
  );
};

export default CardDeck; 