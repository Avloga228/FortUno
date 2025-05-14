import React, { useEffect, useState } from "react";
import "./DiceRoller.css";

const fortunoDiceEffects = [
  "+1 карта та пропуск ходу",
  "+3 картини та пропуск ходу",
  "Обмін картами з всіма гравцями по часовій стрілці та пропуск ходу",
  "-1 карта та пропуск ходу",
  "Пропуск ходу тому, хто виклав карту Фортуно",
  "Гравець, що виклав карту Фортуно, забирає карту назад та пропускає хід"
];

export default function DiceRoller({ onResult, serverDiceResult, onFinished }) {
  const [rolling, setRolling] = useState(true);
  const [diceValue, setDiceValue] = useState(1);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    // Анімація кидання кубика (випадкові значення лише для анімації)
    const rollInterval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
    }, 100);

    // Зупиняємо через 2 секунди
    const stopTimeout = setTimeout(() => {
      clearInterval(rollInterval);
      setRolling(false);
      
      // Використовуємо результат від сервера замість генерації нового
      const finalValue = serverDiceResult || Math.floor(Math.random() * 6) + 1;
      setDiceValue(finalValue);
      setShowResult(true);
      
      // Повідомляємо про результат через callback
      onResult(finalValue);
      
      // Чекаємо ще 5 секунд перед завершенням
      setTimeout(() => {
        setShowResult(false);
        
        // Повідомляємо про завершення анімації
        if (onFinished) {
          onFinished(finalValue);
        }
      }, 5000);
    }, 2000);

    return () => {
      clearInterval(rollInterval);
      clearTimeout(stopTimeout);
    };
  }, [onResult, serverDiceResult, onFinished]);

  return (
    <div className="dice-roller-container">
      <div className={`dice ${rolling ? "rolling" : ""}`}>
        <div className="dice-face">{diceValue}</div>
      </div>
      <div className="dice-effect">
        {!rolling && (
          <div className={`effect-text ${showResult ? "fade-in" : ""}`}>
            <h3>Результат:</h3>
            <p>{fortunoDiceEffects[diceValue - 1]}</p>
          </div>
        )}
      </div>
    </div>
  );
} 