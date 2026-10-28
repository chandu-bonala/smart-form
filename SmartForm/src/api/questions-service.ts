import { httpClient } from './client';
import { ENDPOINTS } from '../constants/api';

export type QuestionType =
  | 'short_text'
  | 'paragraph'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'time'
  | 'dropdown'
  | 'checkbox'
  | 'radio'
  | 'rating'
  | 'yes_no'
  | 'file_upload'
  | 'url'
  | 'password'
  | 'signature'
  | 'section_title'
  | 'image';

export interface QuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionItem {
  id: string;
  form_id: string;
  branch_id: string | null;
  title: string;
  question_type: QuestionType;
  placeholder: string | null;
  required: boolean;
  order_index: number;
  validation: Record<string, unknown> | null;
  options: QuestionOption[];
  created_at: string;
  updated_at: string;
}

export interface QuestionOptionPayload {
  option_text: string;
  order_index: number;
}

export interface CreateQuestionPayload {
  form_id: string;
  branch_id?: string | null;
  title: string;
  question_type: QuestionType;
  placeholder?: string | null;
  required?: boolean;
  order_index?: number;
  validation?: Record<string, unknown> | null;
  options?: QuestionOptionPayload[];
}

export type UpdateQuestionPayload = Partial<Omit<CreateQuestionPayload, 'form_id'>>;

export const questionsService = {
  listByForm: async (formId: string): Promise<QuestionItem[]> => {
    const response = await httpClient.get<QuestionItem[]>(ENDPOINTS.QUESTIONS.LIST_BY_FORM(formId));
    return response.data;
  },

  create: async (payload: CreateQuestionPayload): Promise<QuestionItem> => {
    const response = await httpClient.post<QuestionItem>(ENDPOINTS.QUESTIONS.CREATE, payload);
    return response.data;
  },

  update: async (id: string, payload: UpdateQuestionPayload): Promise<QuestionItem> => {
    const response = await httpClient.put<QuestionItem>(ENDPOINTS.QUESTIONS.UPDATE(id), payload);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await httpClient.delete(ENDPOINTS.QUESTIONS.DELETE(id));
  },
};
