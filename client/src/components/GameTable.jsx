import React from "react";
import "./GameTable.css";

const GameTable = ({ children, discardPile, deckClick, currentPlayerId, yourId }) => {
  return (
    <div className="game-table">
      <div className="table-surface">
        {children}
      </div>
    </div>
  );
};

export default GameTable; 