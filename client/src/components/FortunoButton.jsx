import React, { useState, useEffect } from 'react';
import './FortunoButton.css';

const FortunoButton = ({ isVisible, onFortunoClick }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isVisible) {
      // Generate random position within viewport bounds
      const maxX = window.innerWidth - 150; // button width
      const maxY = window.innerHeight - 60; // button height
      const x = Math.random() * maxX;
      const y = Math.random() * maxY;
      setPosition({ x, y });
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div 
      className="fortuno-button-container"
      style={{
        left: position.x,
        top: position.y
      }}
    >
      <button 
        className="fortuno-button"
        onClick={onFortunoClick}
      >
        FORTUNO!
      </button>
    </div>
  );
};

export default FortunoButton; 