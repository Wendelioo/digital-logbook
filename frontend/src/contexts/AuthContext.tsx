import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Login, Logout } from '../../wailsjs/go/main/App';
import type { User } from '../types';
import { useInactivityDetection, useWindowUnload } from '../hooks/useInactivity';

// Extend Window interface to include Wails runtime
declare global {
  interface Window {
    go?: {
      main?: {
        App?: any;
      };
    };
  }
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for saved user session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Handle inactivity and window close
  const handleAutoLogout = useCallback(async () => {
    try {
      if (user && window.go?.main?.App) {
        await Logout(user.id);
      }
    } catch (error) {
      console.error('Auto logout failed:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
    }
  }, [user]);

  useInactivityDetection(handleAutoLogout, !!user);
  useWindowUnload(handleAutoLogout, !!user);

  const login = async (username: string, password: string): Promise<User> => {
    // Clear existing state
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');

    try {
      // Check Wails runtime availability
      if (!window.go?.main?.App) {
        throw new Error('Application runtime not initialized. Please restart the application.');
      }

      const userData = await Login(username, password);
      if (!userData) {
        throw new Error('Invalid credentials');
      }

      // Update state and persist
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (user && window.go?.main?.App) {
        await Logout(user.id);
      }
    } catch (error) {
      console.error('Backend logout failed:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
      sessionStorage.clear();
    }
  };

  const updateUser = (updatedUserData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...updatedUserData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      updateUser,
      isAuthenticated 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
