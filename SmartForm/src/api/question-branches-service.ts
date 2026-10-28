import { httpClient } from './client';
import { ENDPOINTS } from '../constants/api';

export interface QuestionBranchItem {
  id: string;
  form_id: string;
  trigger_question_id: string;
  trigger_option_text: string;
  title: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionBranchPayload {
  form_id: string;
  trigger_question_id: string;
  trigger_option_text: string;
  title: string;
  description?: string | null;
  order_index?: number;
}

export interface UpdateQuestionBranchPayload {
  trigger_option_text?: string;
  title?: string;
  description?: string | null;
  order_index?: number;
}

export const questionBranchesService = {
  get: async (id: string): Promise<QuestionBranchItem> => {
    const response = await httpClient.get<QuestionBranchItem>(ENDPOINTS.QUESTION_BRANCHES.GET(id));
    return response.data;
  },

  listByForm: async (formId: string): Promise<QuestionBranchItem[]> => {
    const response = await httpClient.get<QuestionBranchItem[]>(ENDPOINTS.QUESTION_BRANCHES.LIST_BY_FORM(formId));
    return response.data;
  },

  create: async (payload: QuestionBranchPayload): Promise<QuestionBranchItem> => {
    const response = await httpClient.post<QuestionBranchItem>(ENDPOINTS.QUESTION_BRANCHES.CREATE, payload);
    return response.data;
  },

  update: async (id: string, payload: UpdateQuestionBranchPayload): Promise<QuestionBranchItem> => {
    const response = await httpClient.put<QuestionBranchItem>(ENDPOINTS.QUESTION_BRANCHES.UPDATE(id), payload);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await httpClient.delete(ENDPOINTS.QUESTION_BRANCHES.DELETE(id));
  },
};
