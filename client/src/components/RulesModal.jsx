import React from 'react';
import './RulesModal.css';

const RulesModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="rules-modal-overlay" onClick={onClose}>
      <div className="rules-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="rules-modal-close" onClick={onClose}>×</button>
        
        <h2>Правила гри ФортУно</h2>
        
        <div className="rules-container">
          <section className="rules-section">
            <h3>Основні правила</h3>
            <ul>
              <li>Кількість гравців: 2-4</li>
              <li>Кожному роздається по 8 карт</li>
              <li>Всього в колоді 112 карт</li>
            </ul>
          </section>

          <section className="rules-section">
            <h3>Типи карт</h3>
            <div className="card-types">
              <div className="card-type">
                <h4>Звичайні карти</h4>
                <ul>
                  <li>Цифри: 1-9</li>
                  <li>Спеціальні: "Пропуск ходу", "Обертання ходу"</li>
                  <li>Кольори: червоний, жовтий, зелений, синій, фіолетовий</li>
                </ul>
              </div>
              <div className="card-type">
                <h4>Чорні карти</h4>
                <ul>
                  <li>"+3 карти"</li>
                  <li>"+5 карт"</li>
                  <li>"ФортУно"</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="rules-section">
            <h3>Правила ходів</h3>
            <ul>
              <li>Можна викладати карту того ж кольору або номіналу, що лежить на столі</li>
              <li>Карти "+3 карти" та "+5 карт" можна викладати тільки якщо немає кольору, що лежить на столі</li>
              <li>Можна блефувати з картами "+3 карти" та "+5 карт"</li>
              <li>Якщо вас запідозрили в блефі:
                <ul>
                  <li>Якщо ви не блефували - запідозривший отримує подвійну кількість карт</li>
                  <li>Якщо ви блефували - ви отримуєте картки, які хотіли видати</li>
                </ul>
              </li>
            </ul>
          </section>

          <section className="rules-section">
            <h3>Карта ФортУно</h3>
            <p>Можна викласти в будь-який момент. Після викладання кидається кубик:</p>
            <ul className="fortuno-effects">
              <li>🎲 1: +1 карта та пропуск ходу</li>
              <li>🎲 2: +3 карти та пропуск ходу</li>
              <li>🎲 3: Обмін картами з усіма гравцями по часовій стрілці та пропуск ходу</li>
              <li>🎲 4: -1 карта (обирається гравцем) та пропуск ходу</li>
              <li>🎲 5: Пропуск ходу</li>
              <li>🎲 6: Повернення карти в руку та пропуск ходу</li>
            </ul>
          </section>

          <section className="rules-section">
            <h3>Перемога</h3>
            <ul>
              <li>Коли залишається 1 карта, потрібно сказати "ФОРТУНО"</li>
              <li>Якщо забули сказати "ФОРТУНО", інші гравці можуть сказати за вас, і ви отримаєте +2 карти</li>
              <li>Виграє той, хто першим викладе останню карту після того, як сказав "ФОРТУНО"</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RulesModal;