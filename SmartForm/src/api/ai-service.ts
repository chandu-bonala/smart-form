import { httpClient } from './client';
import { ENDPOINTS } from '../constants/api';

export interface AiFormQuestion {
  title: string;
  question_type: string;
  required: boolean;
  placeholder?: string | null;
  options: string[];
  validation?: Record<string, unknown> | null;
}

export interface AiFormBuilderRequest {
  objective: string;
  audience?: string | null;
  tone?: string | null;
  question_count?: number;
  include_email?: boolean;
  response_mode?: string | null;
  context?: string | null;
}

export interface AiFormBuilderResponse {
  title: string;
  description: string;
  rationale: string;
  questions: AiFormQuestion[];
  suggested_tags: string[];
  next_steps: string[];
}

export interface AiInsightMetric {
  label: string;
  value: string;
  detail?: string | null;
}

export interface AiAnalysisResponse {
  title: string;
  overview: string;
  deep_overview: string;
  strengths: string[];
  issues: string[];
  opportunities: string[];
  recommendations: string[];
  quick_wins: string[];
  metrics: AiInsightMetric[];
  next_questions: string[];
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatResponse {
  answer: string;
  follow_up_questions: string[];
  suggested_actions: string[];
  tone?: string | null;
}

export const aiService = {
  chat: async (payload: {
    message: string;
    history: AiChatMessage[];
    form_id?: string;
  }): Promise<AiChatResponse> => {
    const response = await httpClient.post<AiChatResponse>(ENDPOINTS.AI.CHAT, payload);
    return response.data;
  },

  buildForm: async (payload: AiFormBuilderRequest): Promise<AiFormBuilderResponse> => {
    const response = await httpClient.post<AiFormBuilderResponse>(ENDPOINTS.AI.BUILD_FORM, payload);
    return response.data;
  },

  analyzeForm: async (formId: string): Promise<AiAnalysisResponse> => {
    const response = await httpClient.post<AiAnalysisResponse>(ENDPOINTS.AI.ANALYZE_FORM(formId), {});
    return response.data;
  },
};
