import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../socket";

// Імпортуємо компоненти
import GameTable from "../components/GameTable";
import GameHeader from "../components/GameHeader";
import CardDeck from "../components/CardDeck";
import PlayerHand from "../components/PlayerHand";
import OpponentView from "../components/OpponentView";
import ColorPicker from "../components/ColorPicker";
import DiceRoller from "../components/DiceRoller";

import "./RoomPage.css";

export default function RoomPage() {
  const { roomId } = useParams();
  const [players, setPlayers] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [hand, setHand] = useState([]);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingBlackCard, setPendingBlackCard] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [showDiceRoller, setShowDiceRoller] = useState(false);
  const [chooseCardToDiscard, setChooseCardToDiscard] = useState(false);
  const [actionBlockedMessage, setActionBlockedMessage] = useState("");
  const [diceResult, setDiceResult] = useState(null);
  const [turnSkippedMessage, setTurnSkippedMessage] = useState("");

  useEffect(() => {
    socket.emit('joinRoom', roomId);

    socket.on('playerJoined', (data) => {
      setPlayers(data.players);
    });

    socket.on('handDealt', ({ hand, discardTop }) => {
      setHand(hand);
      setCurrentCard(discardTop);
    });

    socket.on('updateHandAndDiscard', ({ hand, discardTop }) => {
      setHand(hand);
      setCurrentCard(discardTop);
    });

    socket.on('turnChanged', ({ currentPlayerId }) => {
      setCurrentPlayerId(currentPlayerId);
      // При зміні ходу ховаємо пікер, якщо він був відкритий
      setShowColorPicker(false);
      setPendingBlackCard(null);
      // Ховаємо будь-які повідомлення про блокування
      setActionBlockedMessage("");
    });

    socket.on('gameStarted', ({ discardTop, players }) => {
      setCurrentCard(discardTop);
      setPlayers(players);
      setGameStarted(true); // Гра почалася — вимикаємо кнопку
    });

    socket.on('updatePlayers', ({ players }) => {
      setPlayers(players);
    });

    // Додаємо обробник події кидання кубика Фортуно
    socket.on('fortunoDiceRolled', ({ diceResult, playerId }) => {
      // Зберігаємо результат кубика
      setDiceResult(diceResult);
      // Показуємо кубик усім гравцям
      setShowDiceRoller(true);
    });

    // Додаємо обробник події вибору картини для скидання
    socket.on('chooseCardToDiscard', () => {
      setChooseCardToDiscard(true);
    });

    // Обробник блокування дій
    socket.on('actionBlocked', ({ message }) => {
      setActionBlockedMessage(message);
      
      // Автоматично ховаємо повідомлення через 3 секунди
      setTimeout(() => {
        setActionBlockedMessage("");
      }, 3000);
    });

    // Обробник пропуску ходу
    socket.on('turnSkipped', ({ skippedPlayerId, currentPlayerId }) => {
      // Показуємо повідомлення про пропуск ходу
      const isCurrentUser = skippedPlayerId === socket.id;
      const message = isCurrentUser 
        ? "Ви пропускаєте свій хід через карту Фортуно" 
        : "Гравець пропускає свій хід через карту Фортуно";
      
      setTurnSkippedMessage(message);
      
      // Ховаємо повідомлення через 3 секунди
      setTimeout(() => {
        setTurnSkippedMessage("");
      }, 3000);
    });

    return () => {
      socket.emit('leaveRoom', roomId);
      socket.off('playerJoined');
      socket.off('handDealt');
      socket.off('updateHandAndDiscard');
      socket.off('turnChanged');
      socket.off('gameStarted');
      socket.off('updatePlayers');
      socket.off('fortunoDiceRolled');
      socket.off('chooseCardToDiscard');
      socket.off('actionBlocked');
      socket.off('turnSkipped');
    };
  }, [roomId]);

  // Кнопка для старту гри
  const handleStartGame = () => {
    socket.emit('startGame', roomId);
    setGameStarted(true); // Вимикаємо кнопку одразу після натискання
  };

  // Клік по картці для викладання або скидання
  const handlePlayCard = (cardOrIndex, isDiscard = false) => {
    if (currentPlayerId !== socket.id) return;
    
    if (isDiscard) {
      // Скидання карти для ефекту Фортуно №4 (-1 карта)
      socket.emit('discardCard', { roomId, cardIndex: cardOrIndex });
      setChooseCardToDiscard(false);
    } else {
      // Звичайний хід картою
      if (cardOrIndex.color === "black") {
        setShowColorPicker(true);
        setPendingBlackCard(cardOrIndex);
      } else {
        socket.emit('playCard', { roomId, card: cardOrIndex });
      }
    }
  };

  // Вибір кольору для чорної картини
  const handleColorPick = (color) => {
    setShowColorPicker(false);
    if (pendingBlackCard) {
      socket.emit('playCard', { roomId, card: { ...pendingBlackCard, chosenColor: color } });
      setPendingBlackCard(null);
    }
  };

  // Обробка результату кидання кубика
  const handleDiceResult = (result) => {
    // Не закриваємо модальне вікно одразу
    // Компонент сам ховає результат через 5 секунд
    setTimeout(() => {
      setShowDiceRoller(false);
    }, 5000); // Закриваємо модальне вікно через 5 секунд після завершення анімації
  };

  // Обробка завершення анімації кубика - повідомляємо сервер
  const handleDiceFinished = () => {
    socket.emit('fortunoDiceFinished', { roomId });
  };

  // Взяти карту з колоди
  const handleDrawCard = () => {
    if (currentPlayerId !== socket.id) return;
    socket.emit('drawCard', { roomId });
  };

  // Фільтруємо опонентів (всі гравці, крім поточного)
  const opponents = players.filter(p => p.id !== socket.id);

  return (
    <div className="game-page">
      {/* Шапка гри */}
      <GameHeader 
        roomId={roomId}
        playersCount={players.length}
        isCurrentPlayerTurn={currentPlayerId === socket.id}
        actionBlockedMessage={actionBlockedMessage}
        turnSkippedMessage={turnSkippedMessage}
        onStartGame={handleStartGame}
        isGameStarted={gameStarted}
      />
      
      {/* Ігровий стіл */}
      <div className="game-area">
        <GameTable>
          {/* Опоненти */}
          {opponents.map((player, index) => (
            <OpponentView 
              key={player.id}
              player={player}
              position={index + 1}
              isCurrentTurn={currentPlayerId === player.id}
              totalPlayers={players.length}
            />
          ))}
          
          {/* Колода і скиди */}
          <CardDeck
            currentCard={currentCard}
            onDrawCard={handleDrawCard}
            isCurrentPlayerTurn={currentPlayerId === socket.id}
          />
          
          {/* Рука гравця */}
          <PlayerHand 
            hand={hand} 
            isCurrentPlayerTurn={currentPlayerId === socket.id}
            onPlayCard={handlePlayCard}
            chooseCardToDiscard={chooseCardToDiscard}
          />
        </GameTable>
      </div>
      
      {/* Модальні вікна */}
      {showColorPicker && (
        <div className="modal-overlay">
          <ColorPicker onPick={handleColorPick} />
        </div>
      )}
      
      {showDiceRoller && (
        <div className="modal-overlay">
          <DiceRoller 
            onResult={handleDiceResult} 
            serverDiceResult={diceResult} 
            onFinished={handleDiceFinished} 
          />
        </div>
      )}
      
      {/* Dev-панель (якщо потрібна) */}
      <div className="dev-panel">
        {gameStarted && <button onClick={() => socket.emit('devGiveCard', { roomId, value: 'ФортУно', color: 'black' })}>
          Фортуно
        </button>}
        {gameStarted && <button onClick={() => socket.emit('devGiveCard', { roomId, value: 'Пропуск ходу', color: 'red' })}>
          Пропуск
        </button>}
      </div>
    </div>
  );
}