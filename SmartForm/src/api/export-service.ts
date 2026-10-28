import { API_VERSION, BASE_URL, ENDPOINTS } from '../constants/api';

export const exportService = {
  csvUrl: (formId: string): string => `${BASE_URL}${API_VERSION}${ENDPOINTS.EXPORT.CSV(formId)}`,
  jsonUrl: (formId: string): string => `${BASE_URL}${API_VERSION}${ENDPOINTS.EXPORT.JSON(formId)}`,
  xlsxUrl: (formId: string): string => `${BASE_URL}${API_VERSION}${ENDPOINTS.EXPORT.XLSX(formId)}`,
  docxUrl: (formId: string): string => `${BASE_URL}${API_VERSION}${ENDPOINTS.EXPORT.DOCX(formId)}`,
  analyticsUrl: (formId: string): string => `${BASE_URL}${API_VERSION}${ENDPOINTS.EXPORT.ANALYTICS(formId)}`,
};
