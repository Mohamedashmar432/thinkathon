import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { User } from '../../../shared/types';

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
      console.log('Fetching user data...');
      const response = await axios.get('/api/auth/me');
      console.log('User data response:', response.data);
      setUser(response.data.user);
    } catch (error: any) {
      console.error('Fetch user error:', error);
      console.log('Removing invalid token...');
      localStorage.removeItem('token');
      setToken(null);
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting login for:', email);
      const response = await axios.post('/api/auth/login', { email, password });
      console.log('Login response:', response.data);
      
      if (response.data.success) {
        const { token: newToken, user: newUser } = response.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        console.log('Login successful for:', email);
      } else {
        console.error('Login failed:', response.data.message);
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response?.status === 429) {
        throw new Error('Too many login attempts. Please wait a few minutes and try again.');
      }
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      console.error('Final error message:', errorMessage);
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
      console.log('Attempting signup for:', email);
      const response = await axios.post('/api/auth/signup', {
        email,
        password,
        firstName,
        lastName,
      });
      console.log('Signup response:', response.data);
      
      if (response.data.success) {
        const { token: newToken, user: newUser } = response.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        console.log('Signup successful for:', email);
      } else {
        console.error('Signup failed:', response.data.message);
        throw new Error(response.data.message || 'Signup failed');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.response?.status === 429) {
        throw new Error('Too many registration attempts. Please wait a few minutes and try again.');
      }
      const errorMessage = error.response?.data?.message || error.message || 'Signup failed';
      console.error('Final error message:', errorMessage);
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

