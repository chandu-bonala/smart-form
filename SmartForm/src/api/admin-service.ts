import { httpClient } from './client';
import { ENDPOINTS } from '../constants/api';
import { AnalyticsDashboard, FormAnalytics, UserAnalytics } from './analytics-service';
import { FormItem, FormListResponse } from './forms-service';
import { User } from '../context/types';

export interface AdminDashboardSummary {
  total_users: number;
  active_users: number;
  verified_users: number;
  admin_users: number;
  total_forms: number;
  published_forms: number;
  draft_forms: number;
  archived_forms: number;
  total_responses: number;
}

export interface AdminUserUpdatePayload {
  name?: string;
  email?: string;
  role?: User['role'];
  profile_image?: string | null;
  is_verified?: boolean;
  is_active?: boolean;
  password?: string;
}

export const adminService = {
  getDashboard: async (): Promise<AdminDashboardSummary> => {
    const response = await httpClient.get<AdminDashboardSummary>(ENDPOINTS.ADMIN.DASHBOARD);
    return response.data;
  },

  getAnalyticsDashboard: async (): Promise<AnalyticsDashboard> => {
    const response = await httpClient.get<AnalyticsDashboard>(ENDPOINTS.ADMIN.ANALYTICS_DASHBOARD);
    return response.data;
  },

  getAnalyticsUsers: async (): Promise<UserAnalytics> => {
    const response = await httpClient.get<UserAnalytics>(ENDPOINTS.ADMIN.ANALYTICS_USERS);
    return response.data;
  },

  listUsers: async (params?: { search?: string; role?: User['role']; is_active?: boolean; is_verified?: boolean }): Promise<{ items: User[]; total: number }> => {
    const response = await httpClient.get<{ items: User[]; total: number }>(ENDPOINTS.ADMIN.USERS, { params });
    return response.data;
  },

  getUser: async (userId: string): Promise<User> => {
    const response = await httpClient.get<User>(ENDPOINTS.ADMIN.USER(userId));
    return response.data;
  },

  updateUser: async (userId: string, payload: AdminUserUpdatePayload): Promise<User> => {
    const response = await httpClient.patch<User>(ENDPOINTS.ADMIN.USER(userId), payload);
    return response.data;
  },

  updateUserRole: async (userId: string, role: User['role']): Promise<User> => {
    const response = await httpClient.patch<User>(ENDPOINTS.ADMIN.USER_ROLE(userId), { role });
    return response.data;
  },

  updateUserStatus: async (userId: string, is_active: boolean): Promise<User> => {
    const response = await httpClient.patch<User>(ENDPOINTS.ADMIN.USER_STATUS(userId), { is_active });
    return response.data;
  },

  listForms: async (): Promise<FormListResponse> => {
    const response = await httpClient.get<FormListResponse>(ENDPOINTS.ADMIN.FORMS);
    return response.data;
  },

  getForm: async (formId: string): Promise<FormItem> => {
    const response = await httpClient.get<FormItem>(ENDPOINTS.ADMIN.FORM(formId));
    return response.data;
  },

  getFormResponses: async (formId: string): Promise<{ items: any[]; total: number }> => {
    const response = await httpClient.get<{ items: any[]; total: number }>(ENDPOINTS.ADMIN.FORM_RESPONSES(formId));
    return response.data;
  },

  getFormAnalytics: async (formId: string): Promise<FormAnalytics> => {
    const response = await httpClient.get<FormAnalytics>(ENDPOINTS.ADMIN.FORM_ANALYTICS(formId));
    return response.data;
  },
};
