import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { User } from '../../shared/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      if (response.data.success) {
        const { token: newToken, user: newUser } = response.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new Error('Too many login attempts. Please wait a few minutes and try again.');
      }
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      throw new Error(errorMessage);
    }
  };

  const signup = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ) => {
    try {
      const response = await axios.post('/api/auth/signup', {
        email,
        password,
        firstName,
        lastName,
      });
      if (response.data.success) {
        const { token: newToken, user: newUser } = response.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      } else {
        throw new Error(response.data.message || 'Signup failed');
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        throw new Error('Too many registration attempts. Please wait a few minutes and try again.');
      }
      const errorMessage = error.response?.data?.message || error.message || 'Signup failed';
      throw new Error(errorMessage);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

