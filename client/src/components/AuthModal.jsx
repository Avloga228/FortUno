import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState('login'); // login or register
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Будь ласка, заповніть всі поля');
      return;
    }
    
    setLoading(true);
    
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
      // Close modal on success
      onClose();
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>×</button>
        
        <h2>{mode === 'login' ? 'Увійти' : 'Зареєструватися'}</h2>
        
        {error && <div className="auth-error">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Нікнейм</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          
          <button 
            type="submit" 
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading 
              ? 'Зачекайте...' 
              : (mode === 'login' ? 'Увійти' : 'Зареєструватися')}
          </button>
        </form>
        
        <div className="auth-switch">
          {mode === 'login' ? (
            <p>
              Не маєте облікового запису?{' '}
              <button 
                onClick={() => setMode('register')}
                className="auth-switch-btn"
              >
                Зареєструватися
              </button>
            </p>
          ) : (
            <p>
              Вже маєте обліковий запис?{' '}
              <button 
                onClick={() => setMode('login')}
                className="auth-switch-btn"
              >
                Увійти
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal; 