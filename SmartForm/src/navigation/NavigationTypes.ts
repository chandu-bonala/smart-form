export type AuthStackParamList = {
  Landing: undefined;
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Dashboard: undefined;
  FormsList: undefined;
  FormCreate: { template?: { title: string; description?: string } } | undefined;
  AiStudio: undefined;
  ResponseAnalyzer: undefined;
  FormDetail: { formId: string };
  FormPreview: { formId: string };
  FormConditions: { formId: string; questionId: string };
  BranchDetail: { formId: string; triggerQuestionId: string; branchId?: string | null };
  FormShare: { formId: string };
  FormResponses: { formId: string };
  FormVersionDetail: { formId: string; versionNumber: number };
  Analytics: undefined;
  Profile: undefined;
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  AdminUsers: undefined;
  AdminForms: undefined;
  AdminAnalytics: undefined;
  AdminFormDetail: { formId: string };
  AdminFormResponses: { formId: string };
  AdminUserDetail: { userId: string };
};

export type RootStackParamList = {
  AuthStack: undefined;
  AppStack: undefined;
  AdminStack: undefined;
  PublicForm: { slug: string };
};
