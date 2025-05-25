import React, { createContext, useState, useEffect, useContext } from 'react';
import { socket } from '../socket';
import { API_URL } from '../config';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Only authenticate once when the app loads
  useEffect(() => {
    console.log('AuthContext: Initializing with API_URL:', API_URL);
    console.log('AuthContext: Window location:', window.location.hostname);
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
        console.log('AuthContext: Verifying token with URL:', `${API_URL}/api/users/me`);
        fetch(`${API_URL}/api/users/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => {
            console.log('AuthContext: Token verification response status:', res.status);
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
      const url = `${API_URL}/api/users/register`;
      console.log('AuthContext: Registering with URL:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      console.log('AuthContext: Register response status:', response.status);
      const data = await response.json();
      console.log('AuthContext: Register response data:', data);

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
      console.error('Register error:', err);
      setError(err.message);
      throw err;
    }
  };

  const login = async (username, password) => {
    try {
      setError(null);
      const url = `${API_URL}/api/users/login`;
      console.log('AuthContext: Logging in with URL:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        mode: 'cors',
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      console.log('AuthContext: Login response status:', response.status);
      const data = await response.json();
      console.log('AuthContext: Login response data:', data);

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
      console.error('Login error:', err);
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