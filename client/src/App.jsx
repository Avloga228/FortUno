import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000'); // якщо бекенд і фронт на різних портах

function App() {
  const [buttons, setButtons] = useState([false, false]);

  useEffect(() => {
    socket.on('update', (state) => {
      setButtons(state);
    });

    // Очищення підписки при розмонтуванні
    return () => {
      socket.off('update');
    };
  }, []);

  const handleClick = (index) => {
    if (!buttons[index]) {
      socket.emit('press', index);
    }
  };

  return (
    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '40px'}}>
      {buttons.map((isRed, idx) => (
        <button
          key={idx}
          onClick={() => handleClick(idx)}
          style={{
            width: '120px',
            height: '120px',
            fontSize: '2rem',
            background: isRed ? 'red' : 'green',
            color: 'white',
            border: 'none',
            borderRadius: '20px',
            cursor: isRed ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s'
          }}
          disabled={isRed}
        >
          Кнопка {idx + 1}
        </button>
      ))}
    </div>
  );
}

export default App;