import React, { useState, useRef, useEffect } from 'react';
import './GameChat.css';

const GameChat = ({ socket, roomId, username, isExpanded = true }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [isChatExpanded, setIsChatExpanded] = useState(isExpanded);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const typingTimeoutRef = useRef({});

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Reset unread count when expanding chat
  useEffect(() => {
    if (isChatExpanded) {
      setUnreadCount(0);
    }
  }, [isChatExpanded]);

  // Handle incoming messages
  useEffect(() => {
    if (!socket) return;

    socket.on('chatMessage', (message) => {
      setMessages(prev => [...prev, message]);
      if (!isChatExpanded) {
        setUnreadCount(prev => prev + 1);
      }
    });

    socket.on('systemMessage', (message) => {
      setMessages(prev => [...prev, { ...message, isSystem: true }]);
    });

    socket.on('userTyping', ({ username: typingUser, isTyping: typing }) => {
      setIsTyping(prev => ({ ...prev, [typingUser]: typing }));
    });

    return () => {
      socket.off('chatMessage');
      socket.off('systemMessage');
      socket.off('userTyping');
    };
  }, [socket, isChatExpanded]);

  // Handle typing indicator
  const handleTyping = () => {
    socket.emit('typing', { roomId, isTyping: true });
    
    // Clear previous timeout
    if (typingTimeoutRef.current[username]) {
      clearTimeout(typingTimeoutRef.current[username]);
    }
    
    // Set new timeout
    typingTimeoutRef.current[username] = setTimeout(() => {
      socket.emit('typing', { roomId, isTyping: false });
    }, 2000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    // Enforce message length limit
    if (newMessage.length > 200) {
      alert('Повідомлення занадто довге. Максимальна довжина - 200 символів.');
      return;
    }

    socket.emit('sendMessage', {
      roomId,
      message: newMessage.trim()
    });

    setNewMessage('');
    // Clear typing indicator
    socket.emit('typing', { roomId, isTyping: false });
  };

  const toggleChat = () => {
    setIsChatExpanded(!isChatExpanded);
    if (!isChatExpanded) {
      setUnreadCount(0); // Clear unread count when expanding
    }
  };

  return (
    <div className={`game-chat ${isChatExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="chat-header" onClick={toggleChat}>
        <h3>Чат кімнати</h3>
        <div className="chat-controls">
          {!isChatExpanded && unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
          <button className="chat-toggle-btn">
            {isChatExpanded ? '▼' : '▲'}
          </button>
        </div>
      </div>
      
      {isChatExpanded && (
        <>
          <div className="chat-messages" ref={chatContainerRef}>
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`message-container ${
                  msg.isSystem
                    ? 'system-message'
                    : msg.username === username
                    ? 'own-message'
                    : 'other-message'
                }`}
              >
                {!msg.isSystem && <div className="message-username">{msg.username}</div>}
                <div className="message-bubble">
                  {msg.text}
                </div>
              </div>
            ))}
            {Object.entries(isTyping).map(([user, typing]) => (
              typing && user !== username && (
                <div key={`typing-${user}`} className="typing-indicator">
                  {user} набирає повідомлення...
                </div>
              )
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="chat-input-form">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder="Введіть повідомлення..."
              maxLength={200}
              className="chat-input"
            />
            <button type="submit" className="chat-send-button">
              Надіслати
            </button>
          </form>
        </>
      )}
    </div>
  );
};

export default GameChat; 