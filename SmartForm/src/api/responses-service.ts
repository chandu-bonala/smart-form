import { httpClient } from './client';
import { ENDPOINTS } from '../constants/api';

export interface ResponseItem {
  id: string;
  form_id: string;
  form_version_id: string | null;
  form_version_number: number | null;
  submitted_by: string | null;
  respondent_email: string | null;
  completion_time: number | null;
  ip_address: string | null;
  device: string | null;
  browser: string | null;
  submitted_at: string;
  answers: Array<{
    id: string;
    response_id: string;
    question_id: string | null;
    question_snapshot?: Record<string, unknown> | null;
    answer: string | null;
    file_path?: string | null;
    created_at?: string;
    updated_at?: string;
  }>;
}

export interface ResponseListResponse {
  items: ResponseItem[];
  total: number;
}

export const responsesService = {
  listByForm: async (formId: string): Promise<ResponseListResponse> => {
    const response = await httpClient.get<ResponseListResponse>(ENDPOINTS.RESPONSES.LIST(formId));
    return response.data;
  },

  searchByForm: async (
    formId: string,
    params: { page?: number; page_size?: number; search?: string; start_date?: string; end_date?: string } = {},
  ): Promise<ResponseListResponse> => {
    const response = await httpClient.get<ResponseListResponse>(ENDPOINTS.RESPONSE_SEARCH.BY_FORM(formId), { params });
    return response.data;
  },

  get: async (id: string): Promise<ResponseItem> => {
    const response = await httpClient.get<ResponseItem>(ENDPOINTS.RESPONSES.GET(id));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await httpClient.delete(ENDPOINTS.RESPONSES.DELETE(id));
  },
};
