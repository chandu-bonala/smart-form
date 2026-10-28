import { httpClient } from './client';
import { ENDPOINTS } from '../constants/api';
import { FormItem } from './forms-service';

export interface PublicFormSubmitPayload {
  form_id: string;
  submitted_by?: string | null;
  respondent_email?: string | null;
  completion_time?: number | null;
  ip_address?: string | null;
  device?: string | null;
  browser?: string | null;
  answers: Array<{ question_id: string; answer: string | null; file_path?: string | null }>;
}

export const publicFormsService = {
  get: async (slug: string): Promise<FormItem> => {
    const response = await httpClient.get<FormItem>(ENDPOINTS.PUBLIC.FORM(slug));
    return response.data;
  },

  submit: async (slug: string, payload: PublicFormSubmitPayload): Promise<any> => {
    const response = await httpClient.post(ENDPOINTS.PUBLIC.SUBMIT(slug), payload);
    return response.data;
  },
};
