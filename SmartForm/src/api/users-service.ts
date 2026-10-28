import { httpClient } from './client';
import { ENDPOINTS } from '../constants/api';
import { OtpSentResponse, User } from '../context/types';

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  is_active?: boolean;
  password?: string;
}

export interface UserListResponse {
  items: User[];
  total: number;
}

export const usersService = {
  me: async (): Promise<User> => {
    const response = await httpClient.get<User>(ENDPOINTS.USERS.ME);
    return response.data;
  },

  updateMe: async (payload: UpdateUserPayload): Promise<User> => {
    const response = await httpClient.patch<User>(ENDPOINTS.USERS.ME, payload);
    return response.data;
  },

  uploadAvatar: async (fileUri: string, fileName = 'avatar.jpg', mimeType = 'image/jpeg'): Promise<User> => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);

    const response = await httpClient.post<User>(ENDPOINTS.USERS.AVATAR, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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

  list: async (): Promise<UserListResponse> => {
    const response = await httpClient.get<UserListResponse>(ENDPOINTS.USERS.LIST);
    return response.data;
  },
};
