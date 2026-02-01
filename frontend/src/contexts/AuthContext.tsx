import React, { createContext, useContext, useState, useEffect } from 'react';
import { Login, Logout } from '../../wailsjs/go/main/App';

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

interface User {
  id: number;
  name: string;
  role: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  employee_id?: string;
  student_id?: string;
  email?: string;
  contact_number?: string;
  photo_url?: string;
  created?: string;
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

  // Handle automatic logout on window/app close, timeout, or inactivity
  useEffect(() => {
    if (!user) return;

    let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity

    // Function to reset inactivity timer
    const resetInactivityTimer = () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      inactivityTimer = setTimeout(async () => {
        // Auto logout after inactivity
        try {
          if (window.go && window.go.main && window.go.main.App) {
            await Logout(user.id);
          }
        } catch (error) {
          console.error('Auto logout on inactivity failed:', error);
        } finally {
          setUser(null);
          setIsAuthenticated(false);
          localStorage.removeItem('user');
        }
      }, INACTIVITY_TIMEOUT);
    };

    // Reset timer on user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
      document.addEventListener(event, resetInactivityTimer, true);
    });

    // Start inactivity timer
    resetInactivityTimer();

    // Handle window/app close - use synchronous approach
    const handleBeforeUnload = () => {
      // Use sendBeacon or synchronous XMLHttpRequest for reliable logout on close
      if (window.go && window.go.main && window.go.main.App && user) {
        // Try to call logout - use fire-and-forget approach
        // Note: We can't await in beforeunload, so we'll try our best
        const logoutPromise = Logout(user.id);
        // Store in a way that might complete
        (window as any).__pendingLogout = logoutPromise;
      }
    };

    // Handle component unmount (app closing)
    const handleUnload = async () => {
      if (window.go && window.go.main && window.go.main.App && user) {
        try {
          await Logout(user.id);
        } catch (error) {
          console.error('Logout on unload failed:', error);
        }
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    // Cleanup
    return () => {
      if (inactivityTimer) {
        clearTimeout(inactivityTimer);
      }
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetInactivityTimer, true);
      });
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
      
      // Also try to logout on cleanup (component unmount)
      if (window.go && window.go.main && window.go.main.App && user) {
        Logout(user.id).catch(err => console.error('Logout on cleanup failed:', err));
      }
    };
  }, [user]);

  const login = async (username: string, password: string): Promise<User> => {
    try {
      // Clear any existing user data first
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');

      // Check if Wails runtime is available
      if (!window.go || !window.go.main || !window.go.main.App) {
        throw new Error('Application runtime not initialized. Please restart the application.');
      }

      // Call the backend Login function
      const userData = await Login(username, password);
      
      if (!userData) {
        throw new Error('Invalid credentials');
      }

      // Set user data
      setUser(userData);
      setIsAuthenticated(true);

      // Save to localStorage for persistence
      localStorage.setItem('user', JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error('Login failed:', error);
      // Ensure state is cleared on login failure
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call backend logout if user exists
      if (user && window.go && window.go.main && window.go.main.App) {
        await Logout(user.id);
      }
    } catch (error) {
      console.error('Backend logout failed:', error);
      // Continue with frontend logout even if backend fails
    } finally {
      // Always clear frontend state
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
      
      // Clear any other potential state
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

