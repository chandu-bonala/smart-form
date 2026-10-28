import { httpClient } from './client';
import { ENDPOINTS } from '../constants/api';

export interface AnalyticsDashboard {
  total_forms: number;
  total_responses: number;
  active_forms: number;
  draft_forms: number;
  completion_rate: number;
  average_completion_time: number;
  daily_responses: Array<{ date: string; count: number }>;
  monthly_responses: Array<{ date: string; count: number }>;
  top_forms: Array<{ id: string; label: string; value: number }>;
  device_statistics: Array<{ label: string; value: number }>;
  browser_statistics: Array<{ label: string; value: number }>;
}

export interface UserAnalytics {
  total_users: number;
  verified_users: number;
  admin_users: number;
  active_users: number;
}

export interface FormAnalytics {
  form_id: string;
  title: string;
  total_questions: number;
  total_responses: number;
  average_completion_time: number;
  completion_rate: number;
  daily_responses: Array<{ date: string; count: number }>;
  questions: Array<{
    question_id: string;
    title: string;
    question_type: string;
    total_answers: number;
    skipped: number;
    options: Array<{ option: string; count: number; percentage: number }>;
    text_answers: string[];
    average_rating: number | null;
  }>;
  responses: Array<{
    id: string;
    respondent_label: string;
    respondent_email: string | null;
    submitted_by: string | null;
    submitted_at: string;
    completion_time: number | null;
    device: string | null;
    browser: string | null;
    answers: Array<{
      question_id: string;
      question_title: string;
      question_type: string;
      answer: string | null;
      values: string[];
    }>;
  }>;
}

export const analyticsService = {
  getDashboard: async (): Promise<AnalyticsDashboard> => {
    const response = await httpClient.get<AnalyticsDashboard>(ENDPOINTS.ANALYTICS.DASHBOARD);
    return response.data;
  },

  getUsers: async (): Promise<UserAnalytics> => {
    const response = await httpClient.get<UserAnalytics>(ENDPOINTS.ANALYTICS.USERS);
    return response.data;
  },

  getForm: async (formId: string): Promise<FormAnalytics> => {
    const response = await httpClient.get<FormAnalytics>(ENDPOINTS.ANALYTICS.FORM(formId));
    return response.data;
  },
};
