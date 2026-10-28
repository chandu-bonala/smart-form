import axios, { AxiosInstance, AxiosError } from 'axios';
import { BASE_URL, API_VERSION, REQUEST_TIMEOUT } from '../constants/api';
import { getAccessToken, updateAccessToken, getRefreshToken } from '../utils/storage';

console.log('API Client initializing with BASE_URL:', BASE_URL);

/**
 * Create Axios instance with default config
 */
export const createHttpClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: `${BASE_URL}${API_VERSION}`,
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  /**
   * Request interceptor: Add authorization token
   */
  client.interceptors.request.use(
    async (config) => {
      try {
        const token = await getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('Failed to get access token:', err);
      }
      return config;
    },
    (error) => {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  /**
   * Response interceptor: Handle errors and token refresh
   */
  client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as any;

      // Handle 401 (Unauthorized) - Try to refresh token
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = await getRefreshToken();
          if (refreshToken) {
            console.log('Attempting to refresh token...');
            // Try to refresh the token
            const response = await axios.post(
              `${BASE_URL}${API_VERSION}/auth/refresh`,
              { refresh_token: refreshToken }
            );

            const { access_token } = response.data;
            await updateAccessToken(access_token);

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return client(originalRequest);
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Return original error, let app handle logout
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
};

// Create default client instance
export const httpClient = createHttpClient();

const normalizeMessage = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => normalizeMessage(item))
      .filter(Boolean);
    return parts.join(' • ');
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.detail === 'string') {
      return record.detail;
    }
    if (record.detail !== undefined) {
      return normalizeMessage(record.detail);
    }
    if (typeof record.msg === 'string') {
      return record.msg;
    }
    if (typeof record.message === 'string') {
      return record.message;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return 'An error occurred';
    }
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '';
};

/**
 * Extract error message from API response
 */
export const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const responseData = error.response?.data;
    if (responseData) {
      if (typeof responseData === 'string') {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed?.detail) return normalizeMessage(parsed.detail);
        } catch {
          // Fall through to the generic message handling below.
        }
      }
      if (responseData instanceof ArrayBuffer && typeof TextDecoder !== 'undefined') {
        try {
          const decoded = new TextDecoder().decode(responseData);
          const parsed = JSON.parse(decoded);
          if (parsed?.detail) return normalizeMessage(parsed.detail);
        } catch {
          // Ignore decoding/parsing issues and use the normal fallback.
        }
      }
      if (ArrayBuffer.isView(responseData) && typeof TextDecoder !== 'undefined') {
        try {
          const decoded = new TextDecoder().decode(responseData);
          const parsed = JSON.parse(decoded);
          if (parsed?.detail) return normalizeMessage(parsed.detail);
        } catch {
          // Ignore decoding/parsing issues and use the normal fallback.
        }
      }
    }

    // API error response
    if (error.response?.data?.detail) {
      return normalizeMessage(error.response.data.detail) || 'An error occurred';
    }
    if (error.response?.status === 409) {
      return 'Email already registered';
    }
    if (error.response?.status === 401) {
      return 'Invalid email or password';
    }
    if (error.response?.status === 400) {
      return 'Invalid request. Please check your input.';
    }
    if (error.message === 'Network Error') {
      return 'Network error. Please check your connection.';
    }
    return normalizeMessage(error.message) || 'An error occurred';
  }
  return normalizeMessage(error) || 'An unexpected error occurred';
};
