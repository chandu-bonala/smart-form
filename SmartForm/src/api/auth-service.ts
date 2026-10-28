import { httpClient } from './client';
import { ENDPOINTS } from '../constants/api';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  RefreshRequest,
  User,
  TokenPair,
  OtpSentResponse,
} from '../context/types';

/**
 * Authentication service - All API calls related to auth
 */
export const authService = {
  /**
   * Register new user
   */
  register: async (payload: RegisterRequest): Promise<AuthResponse> => {
    const response = await httpClient.post<AuthResponse>(
      ENDPOINTS.AUTH.REGISTER,
      payload
    );
    return response.data;
  },

  /**
   * Login user
   */
  login: async (payload: LoginRequest): Promise<AuthResponse> => {
    const response = await httpClient.post<AuthResponse>(
      ENDPOINTS.AUTH.LOGIN,
      payload
    );
    return response.data;
  },

  googleLogin: async (idToken: string): Promise<AuthResponse> => {
    const response = await httpClient.post<AuthResponse>(
      ENDPOINTS.AUTH.GOOGLE,
      { id_token: idToken }
    );
    return response.data;
  },

  sendEmailVerification: async (): Promise<OtpSentResponse> => {
    const response = await httpClient.post<OtpSentResponse>(
      ENDPOINTS.AUTH.SEND_EMAIL_VERIFICATION
    );
    return response.data;
  },

  verifyEmail: async (code: string): Promise<User> => {
    const response = await httpClient.post<User>(
      ENDPOINTS.AUTH.VERIFY_EMAIL,
      { code }
    );
    return response.data;
  },

  /**
   * Logout user (call backend to invalidate session if needed)
   */
  logout: async (): Promise<void> => {
    try {
      await httpClient.post(ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue logout even if API call fails
    }
  },

  /**
   * Refresh access token
   */
  refresh: async (refreshToken: string): Promise<TokenPair> => {
    const payload: RefreshRequest = { refresh_token: refreshToken };
    const response = await httpClient.post<TokenPair>(
      ENDPOINTS.AUTH.REFRESH,
      payload
    );
    return response.data;
  },

  /**
   * Get current user profile
   */
  getMe: async (): Promise<User> => {
    const response = await httpClient.get<User>(ENDPOINTS.AUTH.ME);
    return response.data;
  },
};
