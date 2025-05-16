import React, { createContext, useState, useEffect, useContext } from 'react';
import { socket } from '../socket';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Only authenticate once when the app loads
  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('authToken');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      try {
        const userData = JSON.parse(user);
        setUser(userData);
        
        // Authenticate the socket connection
        socket.authenticateOnce(token);
        
        // Verify token validity with server
        fetch('http://localhost:5000/api/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => {
            if (!res.ok) {
              throw new Error('Invalid token');
            }
            return res.json();
          })
          .then(data => {
            console.log('Token verification successful');
            setUser(data.user);
          })
          .catch(err => {
            console.error('Auth verification error:', err);
            logout();
          })
          .finally(() => {
            setLoading(false);
          });
      } catch (err) {
        console.error('Error parsing stored user data:', err);
        logout();
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const register = async (username, password) => {
    try {
      setError(null);
      const response = await fetch('http://localhost:5000/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Помилка реєстрації');
      }

      // Save token and user info
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Set user in state
      setUser(data.user);
      
      // Authenticate the socket connection
      socket.authenticateOnce(data.token);
      
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const login = async (username, password) => {
    try {
      setError(null);
      const response = await fetch('http://localhost:5000/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Помилка входу');
      }

      // Save token and user info
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Set user in state
      setUser(data.user);
      
      // Authenticate the socket connection
      socket.authenticateOnce(data.token);
      
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('currentRoomId');
    
    // Clear user from state
    setUser(null);
    
    // Reconnect socket to clear authentication
    socket.disconnect();
    socket.connect();
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 