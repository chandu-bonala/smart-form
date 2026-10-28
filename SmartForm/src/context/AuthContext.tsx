import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../api/auth-service';
import { getErrorMessage } from '../api/client';
import {
  AuthContextType,
  User,
  StoredAuthData,
} from './types';
import {
  saveAuthData,
  getAuthData,
  clearAuthData,
  getAccessToken,
  getRefreshToken,
} from '../utils/storage';

/**
 * Create Auth Context
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Auth Provider Component
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check if user is authenticated on app startup
   */
  const checkAuth = async () => {
    try {
      // Add a timeout to prevent infinite hangs
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth check timeout')), 10000)
      );

      const authPromise = getAuthData();
      const storedData = await Promise.race([authPromise, timeoutPromise]) as any;

      if (storedData?.user && storedData?.accessToken) {
        console.log('Auth: User found in storage, setting authenticated state');
        setUser(storedData.user);
        setAccessToken(storedData.accessToken);
        setRefreshToken(storedData.refreshToken);
      } else {
        console.log('Auth: No stored auth data found, user is not authenticated');
      }
    } catch (err) {
      console.error('Error checking auth:', err);
      // Continue without auth data - user can login normally
    }
  };

  /**
   * Login user
   */
  const login = async (email: string, password: string): Promise<User> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({
        email,
        password,
      });

      const { user, tokens } = response;
      const authData: StoredAuthData = {
        user,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };

      await saveAuthData(authData);

      setUser(user);
      setAccessToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);
      return user;
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Register user
   */
  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.register({
        name,
        email,
        password,
      });

      const { user, tokens } = response;
      const authData: StoredAuthData = {
        user,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };

      await saveAuthData(authData);

      setUser(user);
      setAccessToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    setIsLoading(true);
    try {
      try {
        await authService.logout();
      } catch (err) {
        console.error('Logout API call failed:', err);
      }

      await clearAuthData();

      setUser(null);
      setAccessToken(null);
      setRefreshToken(null);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string): Promise<User> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.googleLogin(idToken);
      const { user, tokens } = response;
      const authData: StoredAuthData = {
        user,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };

      await saveAuthData(authData);

      setUser(user);
      setAccessToken(tokens.access_token);
      setRefreshToken(tokens.refresh_token);
      return user;
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const setAuthenticatedUser = async (updatedUser: User) => {
    const authData: StoredAuthData = {
      user: updatedUser,
      accessToken,
      refreshToken,
    };
    await saveAuthData(authData);
    setUser(updatedUser);
  };

  const refreshUser = async () => {
    const updatedUser = await authService.getMe();
    await setAuthenticatedUser(updatedUser);
  };

  /**
   * Clear error message
   */
  const clearError = () => {
    setError(null);
  };

  /**
   * Check auth on app startup
   */
  useEffect(() => {
    checkAuth();
  }, []);

  const value: AuthContextType = {
    user,
    accessToken,
    refreshToken,
    isLoading,
    isAuthenticated: user !== null && accessToken !== null,
    error,
    login,
    register,
    loginWithGoogle,
    logout,
    refreshUser,
    setAuthenticatedUser,
    clearError,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to use Auth Context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
