import { httpClient } from './client';
import { ENDPOINTS } from '../constants/api';
import { ResponseListResponse } from './responses-service';
import type { ConditionalRuleItem } from './conditional-rules-service';
import type { QuestionBranchItem } from './question-branches-service';
import type { QuestionItem } from './questions-service';

export interface FormItem {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  status: string;
  is_public: boolean;
  is_hidden: boolean;
  allow_multiple_responses: boolean;
  collect_email: boolean;
  form_slug: string;
  questions: QuestionItem[];
  branches?: QuestionBranchItem[];
  conditional_rules?: ConditionalRuleItem[];
  created_at: string;
  updated_at: string;
}

export interface FormVersionItem {
  id: string;
  form_id: string;
  version_number: number;
  schema_snapshot: Record<string, unknown>;
  is_published: boolean;
  status?: string;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduledActionItem {
  id: string;
  owner_id: string;
  form_id: string;
  action_type: 'publish_form' | 'send_email';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  run_at: string;
  payload: Record<string, unknown>;
  error_message?: string | null;
  executed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormListResponse {
  items: FormItem[];
  total: number;
}

export interface FormVersionListResponse {
  items: FormVersionItem[];
  total: number;
}

export interface CreateFormPayload {
  owner_id: string;
  title: string;
  description?: string;
  status?: string;
  is_public?: boolean;
  is_hidden?: boolean;
  allow_multiple_responses?: boolean;
  collect_email?: boolean;
  form_slug?: string;
}

export interface ShareFormPayload {
  emails: string[];
  url: string;
  subject?: string;
  message?: string;
}

export interface SchedulePublishPayload {
  run_at: string;
}

export interface ScheduleSharePayload extends ShareFormPayload {
  run_at: string;
}

export interface ScheduledActionListResponse {
  items: ScheduledActionItem[];
  total: number;
}

export interface UpdateFormPayload {
  title?: string;
  description?: string | null;
  theme?: Record<string, unknown> | null;
  status?: string;
  is_public?: boolean;
  is_hidden?: boolean;
  allow_multiple_responses?: boolean;
  collect_email?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  form_slug?: string | null;
  qr_code?: string | null;
}

export const formsService = {
  list: async (): Promise<FormListResponse> => {
    const response = await httpClient.get<FormListResponse>(ENDPOINTS.FORMS.LIST);
    return response.data;
  },

  create: async (payload: CreateFormPayload): Promise<FormItem> => {
    const response = await httpClient.post<FormItem>(ENDPOINTS.FORMS.CREATE, payload);
    return response.data;
  },

  get: async (id: string): Promise<FormItem> => {
    const response = await httpClient.get<FormItem>(ENDPOINTS.FORMS.GET(id));
    return response.data;
  },

  update: async (id: string, payload: UpdateFormPayload): Promise<FormItem> => {
    const response = await httpClient.put<FormItem>(ENDPOINTS.FORMS.UPDATE(id), payload);
    return response.data;
  },

  publish: async (id: string): Promise<FormItem> => {
    const response = await httpClient.patch<FormItem>(ENDPOINTS.FORMS.PUBLISH(id));
    return response.data;
  },

  archive: async (id: string): Promise<FormItem> => {
    const response = await httpClient.patch<FormItem>(ENDPOINTS.FORMS.ARCHIVE(id));
    return response.data;
  },

  restore: async (id: string): Promise<FormItem> => {
    const response = await httpClient.patch<FormItem>(ENDPOINTS.FORMS.RESTORE(id));
    return response.data;
  },

  setHidden: async (id: string, isHidden: boolean): Promise<FormItem> => {
    const response = await httpClient.patch<FormItem>(ENDPOINTS.FORMS.VISIBILITY(id), { is_hidden: isHidden });
    return response.data;
  },

  share: async (id: string, payload: ShareFormPayload): Promise<void> => {
    await httpClient.post(ENDPOINTS.FORMS.SHARE(id), payload);
  },

  schedulePublish: async (id: string, payload: SchedulePublishPayload): Promise<ScheduledActionItem> => {
    const response = await httpClient.post<ScheduledActionItem>(ENDPOINTS.FORMS.SCHEDULE_PUBLISH(id), payload);
    return response.data;
  },

  scheduleShare: async (id: string, payload: ScheduleSharePayload): Promise<ScheduledActionItem> => {
    const response = await httpClient.post<ScheduledActionItem>(ENDPOINTS.FORMS.SCHEDULE_SHARE(id), payload);
    return response.data;
  },

  listSchedules: async (id: string): Promise<ScheduledActionListResponse> => {
    const response = await httpClient.get<ScheduledActionListResponse>(ENDPOINTS.FORMS.SCHEDULES(id));
    return response.data;
  },

  duplicate: async (id: string): Promise<FormItem> => {
    const response = await httpClient.post<FormItem>(ENDPOINTS.FORMS.DUPLICATE(id));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await httpClient.delete(ENDPOINTS.FORMS.DELETE(id));
  },

  listVersions: async (id: string): Promise<FormVersionListResponse> => {
    const response = await httpClient.get<FormVersionListResponse>(ENDPOINTS.FORMS.VERSIONS(id));
    return response.data;
  },
  
  listVersionResponses: async (id: string, version: number): Promise<ResponseListResponse> => {
    const response = await httpClient.get<ResponseListResponse>(ENDPOINTS.FORMS.VERSION_RESPONSES(id, version));
    return response.data;
  },
};
