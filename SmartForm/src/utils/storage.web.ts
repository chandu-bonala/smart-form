import { StoredAuthData, User } from '../context/types';

const AUTH_STORAGE_KEY = 'smartform_auth_data';
const ACCESS_TOKEN_KEY = 'smartform_access_token';
const REFRESH_TOKEN_KEY = 'smartform_refresh_token';
const USER_KEY = 'smartform_user';

const isLocalStorageAvailable = () => {
  try {
    return typeof window !== 'undefined' && window.localStorage !== null;
  } catch {
    return false;
  }
};

const localStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (isLocalStorageAvailable()) {
        return window.localStorage.getItem(key);
      }
    } catch (error) {
      console.warn('localStorage getItem failed:', error);
    }
    return null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (isLocalStorageAvailable()) {
        window.localStorage.setItem(key, value);
      }
    } catch (error) {
      console.warn('localStorage setItem failed:', error);
    }
  },
  multiRemove: async (keys: string[]): Promise<void> => {
    try {
      if (isLocalStorageAvailable()) {
        keys.forEach((key) => window.localStorage.removeItem(key));
      }
    } catch (error) {
      console.warn('localStorage multiRemove failed:', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (isLocalStorageAvailable()) {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn('localStorage removeItem failed:', error);
    }
  },
};

export const saveAuthData = async (data: StoredAuthData): Promise<void> => {
  try {
    await localStorageAdapter.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    if (data.accessToken) {
      await localStorageAdapter.setItem(ACCESS_TOKEN_KEY, data.accessToken);
    }
    if (data.refreshToken) {
      await localStorageAdapter.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    if (data.user) {
      await localStorageAdapter.setItem(USER_KEY, JSON.stringify(data.user));
    }
  } catch (error) {
    console.error('Error saving auth data:', error);
    throw error;
  }
};

export const getAuthData = async (): Promise<StoredAuthData | null> => {
  try {
    const data = await localStorageAdapter.getItem(AUTH_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error retrieving auth data:', error);
    return null;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  try {
    return await localStorageAdapter.getItem(ACCESS_TOKEN_KEY);
  } catch (error) {
    console.error('Error retrieving access token:', error);
    return null;
  }
};

export const getRefreshToken = async (): Promise<string | null> => {
  try {
    return await localStorageAdapter.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Error retrieving refresh token:', error);
    return null;
  }
};

export const getUser = async (): Promise<User | null> => {
  try {
    const data = await localStorageAdapter.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error retrieving user:', error);
    return null;
  }
};

export const clearAuthData = async (): Promise<void> => {
  try {
    await localStorageAdapter.multiRemove([
      AUTH_STORAGE_KEY,
      ACCESS_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      USER_KEY,
    ]);
  } catch (error) {
    console.error('Error clearing auth data:', error);
    throw error;
  }
};

export const updateAccessToken = async (token: string): Promise<void> => {
  try {
    await localStorageAdapter.setItem(ACCESS_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error updating access token:', error);
    throw error;
  }
};
