import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Login, Logout, UnlockScreen, LockScreen, IsKioskMode } from '../../wailsjs/go/main/App';
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
const AUTH_STATUS_CHANGED_EVENT = 'auth-status-changed';
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const RUNTIME_WAIT_TIMEOUT_MS = 5000;
const RUNTIME_WAIT_INTERVAL_MS = 50;

function isWailsRuntimeReady() {
  return !!window.go?.main?.App;
}

async function waitForWailsRuntime(timeoutMs = RUNTIME_WAIT_TIMEOUT_MS): Promise<boolean> {
  if (isWailsRuntimeReady()) return true;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, RUNTIME_WAIT_INTERVAL_MS));
    if (isWailsRuntimeReady()) return true;
  }

  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const logoutInProgressRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = () => {
      if (!window.go?.main?.App?.TouchSession) return;
      window.go.main.App.TouchSession(user.id).catch(() => {});
    };

    sendHeartbeat();
    const heartbeatTimer = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(heartbeatTimer);
    };
  }, [user]);

  const clearLocalSession = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');
    sessionStorage.clear();
    window.dispatchEvent(new CustomEvent(AUTH_STATUS_CHANGED_EVENT));
  }, []);

  // Check for saved user session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
        // If user session exists, unlock screen (kiosk mode - user was already logged in)
        UnlockScreen().catch(() => {});
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Handle inactivity and window close
  const handleAutoLogout = useCallback(async () => {
    if (logoutInProgressRef.current) {
      return;
    }

    logoutInProgressRef.current = true;
    try {
      if (user && window.go?.main?.App) {
        await Logout(user.id);
      }
    } catch (error) {
      console.error('Auto logout failed:', error);
    } finally {
      clearLocalSession();

      // Lock screen in kiosk mode on auto-logout
      try {
        await LockScreen();
      } catch (e) {
        // Silently ignore if not in kiosk mode
      }

      logoutInProgressRef.current = false;
    }
  }, [clearLocalSession, user]);

  useInactivityDetection(handleAutoLogout, !!user);
  useWindowUnload(handleAutoLogout, !!user);

  const login = async (username: string, password: string): Promise<User> => {
    logoutInProgressRef.current = false;

    // Clear existing state
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('user');

    try {
      // Check Wails runtime availability (allow short delay for runtime injection)
      const runtimeReady = await waitForWailsRuntime();
      if (!runtimeReady) {
        throw new Error('Application runtime not initialized. Please run the app via Wails (wails dev or built app).');
      }

      const userData = await Login(username, password);
      if (!userData) {
        throw new Error('Invalid credentials');
      }

      // Update state and persist
      setUser(userData);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(userData));
      window.dispatchEvent(new CustomEvent(AUTH_STATUS_CHANGED_EVENT));

      // Unlock screen in kiosk mode so user can freely use Windows
      try {
        await UnlockScreen();
      } catch (e) {
        // Silently ignore if not in kiosk mode
      }
      
      return userData;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    if (logoutInProgressRef.current) {
      return;
    }

    logoutInProgressRef.current = true;
    try {
      if (user && window.go?.main?.App) {
        await Logout(user.id);
      }
    } catch (error) {
      console.error('Backend logout failed:', error);
    } finally {
      clearLocalSession();

      // Lock screen in kiosk mode so next user must login
      try {
        await LockScreen();
      } catch (e) {
        // Silently ignore if not in kiosk mode
      }

      logoutInProgressRef.current = false;
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
