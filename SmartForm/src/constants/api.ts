// API Configuration
// Prefer an explicit environment variable when provided; otherwise fall back to a local dev host.
const getDefaultBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }

  return 'http://10.0.2.2:8080';
};

const envBaseUrl = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.EXPO_PUBLIC_API_BASE_URL;

export const BASE_URL = envBaseUrl || getDefaultBaseUrl();

export const WEB_BASE_URL = typeof window !== 'undefined' && window.location?.origin
  ? window.location.origin
  : 'http://localhost:19006';

export const API_VERSION = '/api/v1';

export const ENDPOINTS = {
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    ANALYTICS_DASHBOARD: '/admin/analytics/dashboard',
    ANALYTICS_USERS: '/admin/analytics/users',
    USERS: '/admin/users',
    USER: (id: string) => `/admin/users/${id}`,
    USER_ROLE: (id: string) => `/admin/users/${id}/role`,
    USER_STATUS: (id: string) => `/admin/users/${id}/status`,
    FORMS: '/admin/forms',
    FORM: (id: string) => `/admin/forms/${id}`,
    FORM_RESPONSES: (id: string) => `/admin/forms/${id}/responses`,
    FORM_RESPONSES_SEARCH: (id: string) => `/admin/forms/${id}/responses/search`,
    FORM_ANALYTICS: (id: string) => `/admin/forms/${id}/analytics`,
  },
  // Auth endpoints
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    GOOGLE: '/auth/google',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
    SEND_EMAIL_VERIFICATION: '/auth/email-verification/send',
    VERIFY_EMAIL: '/auth/email-verification/verify',
  },
  USERS: {
    ME: '/users/me',
    AVATAR: '/users/me/avatar',
    AVATAR_BY_ID: (id: string) => `/users/${id}/avatar`,
    LIST: '/users',
    GET: (id: string) => `/users/${id}`,
  },
  // Forms endpoints
  FORMS: {
    CREATE: '/forms',
    LIST: '/forms',
    GET: (id: string) => `/forms/${id}`,
    UPDATE: (id: string) => `/forms/${id}`,
    DELETE: (id: string) => `/forms/${id}`,
    PUBLISH: (id: string) => `/forms/${id}/publish`,
    SCHEDULE_PUBLISH: (id: string) => `/forms/${id}/publish/schedule`,
    SHARE: (id: string) => `/forms/${id}/share`,
    SCHEDULE_SHARE: (id: string) => `/forms/${id}/share/schedule`,
    SCHEDULES: (id: string) => `/forms/${id}/schedules`,
    ARCHIVE: (id: string) => `/forms/${id}/archive`,
    RESTORE: (id: string) => `/forms/${id}/restore`,
    VISIBILITY: (id: string) => `/forms/${id}/visibility`,
    DUPLICATE: (id: string) => `/forms/${id}/duplicate`,
    VERSIONS: (id: string) => `/forms/${id}/versions`,
    VERSION_RESPONSES: (id: string, version: number) => `/forms/${id}/versions/${version}/responses`,
  },
  QUESTIONS: {
    CREATE: '/questions',
    LIST_BY_FORM: (formId: string) => `/questions/forms/${formId}`,
    UPDATE: (id: string) => `/questions/${id}`,
    DELETE: (id: string) => `/questions/${id}`,
  },
  QUESTION_BRANCHES: {
    CREATE: '/question-branches',
    LIST_BY_FORM: (formId: string) => `/question-branches/forms/${formId}`,
    GET: (id: string) => `/question-branches/${id}`,
    UPDATE: (id: string) => `/question-branches/${id}`,
    DELETE: (id: string) => `/question-branches/${id}`,
  },
  // Responses endpoints
  RESPONSES: {
    CREATE: '/responses',
    LIST: (formId: string) => `/responses/forms/${formId}`,
    GET: (id: string) => `/responses/${id}`,
    DELETE: (id: string) => `/responses/${id}`,
  },
  RESPONSE_SEARCH: {
    BY_FORM: (formId: string) => `/responses-search/forms/${formId}`,
  },
  // Analytics endpoints
  ANALYTICS: {
    DASHBOARD: '/analytics/dashboard',
    FORMS: '/analytics/forms',
    FORM: (id: string) => `/analytics/forms/${id}`,
    RESPONSES: '/analytics/responses',
    USERS: '/analytics/users',
  },
  AI: {
    CHAT: '/ai/chat',
    BUILD_FORM: '/ai/forms/build',
    ANALYZE_WORKSPACE: '/ai/workspace/analyze',
    ANALYZE_FORM: (formId: string) => `/ai/forms/${formId}/analyze`,
  },
  CONDITIONAL_RULES: {
    CREATE: '/conditional-rules',
    LIST_BY_FORM: (formId: string) => `/conditional-rules/forms/${formId}`,
    UPDATE: (id: string) => `/conditional-rules/${id}`,
    DELETE: (id: string) => `/conditional-rules/${id}`,
  },
  EXPORT: {
    CSV: (formId: string) => `/export/forms/${formId}/csv`,
    JSON: (formId: string) => `/export/forms/${formId}/json`,
    XLSX: (formId: string) => `/export/forms/${formId}/xlsx`,
    DOCX: (formId: string) => `/export/forms/${formId}/docx`,
    ANALYTICS: (formId: string) => `/export/forms/${formId}/analytics`,
  },
  UPLOAD: {
    CREATE: '/upload',
    DELETE: (id: string) => `/upload/${id}`,
    SIGNED_URL: (id: string) => `/upload/${id}/signed-url`,
    DOWNLOAD: (id: string) => `/upload/${id}/download`,
  },
  PUBLIC: {
    FORM: (slug: string) => `/public/forms/${slug}`,
    SUBMIT: (slug: string) => `/public/forms/${slug}/submit`,
  },
};

// Timeout settings (in milliseconds)
export const REQUEST_TIMEOUT = 30000; // 30 seconds

// Retry settings
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 1000; // 1 second
