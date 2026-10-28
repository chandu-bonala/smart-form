import { httpClient } from './client';
import { ENDPOINTS } from '../constants/api';
import type { ConditionalRuleAction, ConditionalRuleOperator } from '../utils/conditional-rules';

export interface ConditionalRuleItem {
  id: string;
  form_id: string;
  trigger_field_id: string;
  trigger_operator: ConditionalRuleOperator;
  trigger_value: string | null;
  target_field_id: string;
  target_action: ConditionalRuleAction;
  created_at: string;
  updated_at: string;
}

export interface ConditionalRuleListResponse {
  items: ConditionalRuleItem[];
  total: number;
}

export interface CreateConditionalRulePayload {
  form_id: string;
  trigger_field_id: string;
  trigger_operator: ConditionalRuleOperator;
  trigger_value?: string | null;
  target_field_id: string;
  target_action: ConditionalRuleAction;
}

export interface UpdateConditionalRulePayload {
  trigger_operator?: ConditionalRuleOperator;
  trigger_value?: string | null;
  target_action?: ConditionalRuleAction;
}

export const conditionalRulesService = {
  listByForm: async (formId: string): Promise<ConditionalRuleListResponse> => {
    const response = await httpClient.get<ConditionalRuleListResponse>(
      ENDPOINTS.CONDITIONAL_RULES.LIST_BY_FORM(formId),
    );
    return response.data;
  },

  create: async (payload: CreateConditionalRulePayload): Promise<ConditionalRuleItem> => {
    const response = await httpClient.post<ConditionalRuleItem>(ENDPOINTS.CONDITIONAL_RULES.CREATE, payload);
    return response.data;
  },

  update: async (id: string, payload: UpdateConditionalRulePayload): Promise<ConditionalRuleItem> => {
    const response = await httpClient.put<ConditionalRuleItem>(ENDPOINTS.CONDITIONAL_RULES.UPDATE(id), payload);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await httpClient.delete(ENDPOINTS.CONDITIONAL_RULES.DELETE(id));
  },
};
