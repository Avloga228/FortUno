import React from "react";
import "./GameTable.css";

const GameTable = ({ children }) => {
  return (
    <div className="game-table">
      <div className="table-surface">
        {children}
      </div>
    </div>
  );
};

export default GameTable; 