import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Share,
  TextInput,
  Switch,
  Linking,
  Animated,
  Platform,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'qrcode';
import { SvgXml } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/NavigationTypes';
import { formsService, FormItem, FormVersionItem, ScheduledActionItem } from '../../api/forms-service';
import { responsesService, ResponseItem } from '../../api/responses-service';
import { questionsService, QuestionItem, QuestionType } from '../../api/questions-service';
import { conditionalRulesService, ConditionalRuleItem } from '../../api/conditional-rules-service';
import { questionBranchesService, QuestionBranchItem } from '../../api/question-branches-service';
import { exportService } from '../../api/export-service';
import { analyticsService, FormAnalytics } from '../../api/analytics-service';
import { getErrorMessage } from '../../api/client';
import { HorizontalBarChart } from '../../components/TrendLineChart';
import { ScheduleDateTimePicker } from '../../components/ScheduleDateTimePicker';
import { API_VERSION, BASE_URL, WEB_BASE_URL } from '../../constants/api';
import { webInputReset } from '../../utils/webInputReset';
import {
  CONDITIONAL_ACTIONS,
  isValidEmail,
  CONDITIONAL_OPERATORS,
  buildQuestionLabelMap,
  describeConditionalRule,
  getConditionalOperatorLabel,
  shouldRuleUseValue,
  type ConditionalRuleAction,
  type ConditionalRuleOperator,
} from '../../utils';

const local = {
  ink: '#172033',
  muted: '#6b7280',
  line: '#e7ebf6',
  soft: '#f7f8fc',
  blue: '#5b4bff',
  green: '#34c759',
  amber: '#f59e0b',
  red: '#ef4444',
};

const cardBorder = 'rgba(91, 75, 255, 0.14)';

const pad = (value: number) => `${value}`.padStart(2, '0');

const formatScheduleDateTime = (date: Date) => {
  const hour24 = date.getHours();
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const datePart = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return `${datePart} at ${pad(hour12)}:${pad(date.getMinutes())} ${period}`;
};

export const questionTypes: Array<{ label: string; value: QuestionType; icon: React.ComponentProps<typeof Feather>['name'] }> = [
  { label: 'Short', value: 'short_text', icon: 'type' },
  { label: 'Paragraph', value: 'paragraph', icon: 'align-left' },
  { label: 'Email', value: 'email', icon: 'mail' },
  { label: 'Date', value: 'date', icon: 'calendar' },
  { label: 'Number', value: 'number', icon: 'hash' },
  { label: 'Radio', value: 'radio', icon: 'radio' },
  { label: 'Checkbox', value: 'checkbox', icon: 'check-square' },
  { label: 'Dropdown', value: 'dropdown', icon: 'chevron-down' },
  { label: 'Rating', value: 'rating', icon: 'star' },
  { label: 'Yes/No', value: 'yes_no', icon: 'help-circle' },
  { label: 'File', value: 'file_upload', icon: 'upload-cloud' },
];

const defaultPlaceholders: Partial<Record<QuestionType, string>> = {
  short_text: 'Short answer',
  paragraph: 'Long answer',
  email: 'Enter your email',
  date: 'Pick a date',
  number: 'Enter a number',
  radio: 'Select one option',
  checkbox: 'Select one or more options',
  dropdown: 'Choose an option',
  rating: 'Rate this question',
  yes_no: 'Yes or No',
  file_upload: 'Upload a file',
};

const AUTO_REFRESH_INTERVAL_MS = 8000;

const getDefaultPlaceholder = (type: QuestionType) => defaultPlaceholders[type] ?? 'Enter answer';

export const FormDetailScreen: React.FC<NativeStackScreenProps<AppStackParamList, 'FormDetail'>> = ({ route, navigation }) => {
  const { formId } = route.params;
  const [form, setForm] = useState<FormItem | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [responseTotal, setResponseTotal] = useState(0);
  const [formAnalytics, setFormAnalytics] = useState<FormAnalytics | null>(null);
  const [rules, setRules] = useState<ConditionalRuleItem[]>([]);
  const [branches, setBranches] = useState<QuestionBranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editSlug, setEditSlug] = useState('');
  const [editPublic, setEditPublic] = useState(false);
  const [editHidden, setEditHidden] = useState(false);
  const [editCollectEmail, setEditCollectEmail] = useState(false);
  const [editMultiple, setEditMultiple] = useState(false);
  const [formVersions, setFormVersions] = useState<FormVersionItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [scheduledActions, setScheduledActions] = useState<ScheduledActionItem[]>([]);
  const [isPublishScheduleVisible, setIsPublishScheduleVisible] = useState(false);
  const [publishScheduleAt, setPublishScheduleAt] = useState<Date | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const [questionTitle, setQuestionTitle] = useState('');
  const [questionPlaceholder, setQuestionPlaceholder] = useState(getDefaultPlaceholder('short_text'));
  const [questionType, setQuestionType] = useState<QuestionType>('short_text');
  const [questionRequired, setQuestionRequired] = useState(false);
  const [questionOptions, setQuestionOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [ruleTriggerQuestionId, setRuleTriggerQuestionId] = useState<string>('');
  const [ruleOperator, setRuleOperator] = useState<ConditionalRuleOperator>('equals');
  const [ruleValue, setRuleValue] = useState<string>('');
  const [ruleTargetQuestionId, setRuleTargetQuestionId] = useState<string>('');
  const [ruleAction, setRuleAction] = useState<ConditionalRuleAction>('show');
  const [isConditionsModalVisible, setIsConditionsModalVisible] = useState(false);
  const [conditionsQuestionId, setConditionsQuestionId] = useState<string | null>(null);
  const [selectedConditionOption, setSelectedConditionOption] = useState<string>('');
  const [followupOperator, setFollowupOperator] = useState<ConditionalRuleOperator>('equals');
  const [followupValue, setFollowupValue] = useState<string>('');
  const [showFollowupBuilder, setShowFollowupBuilder] = useState(false);
  const [expandedFollowupQuestionId, setExpandedFollowupQuestionId] = useState<string | null>(null);
  const [branchTitle, setBranchTitle] = useState('');
  const [branchDescription, setBranchDescription] = useState('');
  const [branchTriggerOption, setBranchTriggerOption] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(16)).current;

  const publicUrl = form ? `${WEB_BASE_URL}/public/forms/${form.form_slug}` : '';
  const averageCompletion = useMemo(() => {
    const values = responses.map((response) => response.completion_time).filter((value): value is number => typeof value === 'number');
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  }, [responses]);
  const responseDetailsById = useMemo(() => {
    const entries = formAnalytics?.responses.map((response) => [response.id, response] as const) ?? [];
    return new Map(entries);
  }, [formAnalytics]);

  const optionType = ['radio', 'checkbox', 'dropdown'].includes(questionType);
  const choiceQuestionTypes = ['radio', 'checkbox', 'dropdown', 'yes_no'];

  useEffect(() => {
    if (questions.length === 0) return;
    if (!ruleTriggerQuestionId) {
      setRuleTriggerQuestionId(selectedQuestionId || questions[0].id);
    }
    if (!ruleTargetQuestionId) {
      setRuleTargetQuestionId(questions[1]?.id || questions[0].id);
    }
  }, [questions, ruleTriggerQuestionId, ruleTargetQuestionId, selectedQuestionId]);

  useEffect(() => {
    if (!ruleTriggerQuestionId || ruleTargetQuestionId !== ruleTriggerQuestionId) return;
    const nextTarget = questions.find((question) => question.id !== ruleTriggerQuestionId);
    setRuleTargetQuestionId(nextTarget?.id ?? '');
  }, [questions, ruleTargetQuestionId, ruleTriggerQuestionId]);

  const questionRules = useMemo(() => {
    return new Map(
      questions.map((question) => [
        question.id,
        rules.filter((rule) => rule.trigger_field_id === question.id),
      ]),
    );
  }, [questions, rules]);
  const branchesByQuestion = useMemo(() => {
    return new Map(
      questions.map((question) => [
        question.id,
        branches.filter((branch) => branch.trigger_question_id === question.id),
      ]),
    );
  }, [branches, questions]);
  const questionLabelMap = useMemo(() => buildQuestionLabelMap(questions), [questions]);
  const conditionsQuestion = useMemo(
    () => questions.find((question) => question.id === conditionsQuestionId) ?? null,
    [conditionsQuestionId, questions],
  );
  const conditionAnswerOptions = useMemo(() => {
    if (conditionsQuestion?.question_type === 'yes_no' && (conditionsQuestion.options ?? []).length === 0) {
      return [
        { id: 'yes', option_text: 'Yes' },
        { id: 'no', option_text: 'No' },
      ];
    }
    return conditionsQuestion?.options ?? [];
  }, [conditionsQuestion]);
  const followupConditionValue = useMemo(
    () => (choiceQuestionTypes.includes(conditionsQuestion?.question_type || '') ? selectedConditionOption : followupValue).trim(),
    [choiceQuestionTypes, conditionsQuestion?.question_type, followupValue, selectedConditionOption],
  );
  const followupNeedsValue = shouldRuleUseValue(followupOperator);
  const selectedConditionChildren = useMemo(() => {
    if (!conditionsQuestionId) return [];
    if (followupNeedsValue && !followupConditionValue) return [];

    return rules
      .filter(
        (rule) =>
          rule.trigger_field_id === conditionsQuestionId &&
          rule.target_action === 'show' &&
          rule.trigger_operator === followupOperator &&
          (followupNeedsValue ? (rule.trigger_value ?? '').trim() === followupConditionValue : true),
      )
      .map((rule) => questions.find((question) => question.id === rule.target_field_id))
      .filter(Boolean) as QuestionItem[];
  }, [conditionsQuestionId, followupConditionValue, followupNeedsValue, followupOperator, questions, rules]);
  const currentRulePreview = useMemo(
    () =>
      describeConditionalRule(
        {
          trigger_field_id: ruleTriggerQuestionId,
          trigger_operator: ruleOperator,
          trigger_value: ruleValue,
          target_field_id: ruleTargetQuestionId,
          target_action: ruleAction,
        },
        questionLabelMap,
      ),
    [questionLabelMap, ruleAction, ruleOperator, ruleTargetQuestionId, ruleTriggerQuestionId, ruleValue],
  );
  const nextPublishSchedule = useMemo(
    () =>
      scheduledActions.find(
        (action) => action.action_type === 'publish_form' && ['pending', 'processing'].includes(action.status),
      ) ?? null,
    [scheduledActions],
  );

  const openQr = async () => {
    if (!publicUrl) return;

    setQrVisible(true);
    setQrSvg(null);

    try {
      setQrLoading(true);
      const svg = await QRCode.toString(publicUrl, {
        type: 'svg',
        width: 280,
        margin: 1,
        color: {
          dark: '#172033',
          light: '#FFFFFF',
        },
      });
      setQrSvg(svg);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      Alert.alert('QR code failed', message);
      setQrVisible(false);
    } finally {
      setQrLoading(false);
    }
  };

  const hydrateFormState = (formData: FormItem) => {
    setEditTitle(formData.title);
    setEditDescription(formData.description ?? '');
    setEditSlug(formData.form_slug);
    setEditPublic(formData.is_public);
    setEditHidden(formData.is_hidden ?? false);
    setEditCollectEmail(formData.collect_email);
    setEditMultiple(formData.allow_multiple_responses);
  };

  const showDraftVersionNotice = (nextVersionNumber: number) => {
    Alert.alert(
      'New draft version ready',
      `You edited a published form. The form is now a draft and will become version ${nextVersionNumber} when you publish again.`,
    );
  };

  const loadVersions = async (formId: string) => {
    try {
      setVersionsLoading(true);
      const versionResponse = await formsService.listVersions(formId);
      setFormVersions(versionResponse.items);
    } catch (err) {
      console.warn('Load versions failed', err);
    } finally {
      setVersionsLoading(false);
    }
  };

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [formData, questionData, responseData, ruleData, analyticsData, scheduleData] = await Promise.all([
        formsService.get(formId),
        questionsService.listByForm(formId),
        responsesService.searchByForm(formId, { page: 1, page_size: 20, search: submittedSearch.trim() || undefined }),
        conditionalRulesService.listByForm(formId),
        analyticsService.getForm(formId),
        formsService.listSchedules(formId),
      ]);
      setForm(formData);
      hydrateFormState(formData);
      setQuestions(questionData);
      setResponses(responseData.items);
      setResponseTotal(responseData.total);
      setRules(ruleData.items);
      setBranches((formData.branches ?? []).slice());
      setFormAnalytics(analyticsData);
      setScheduledActions(scheduleData.items);
      await loadVersions(formData.id);
      return formData;
    } catch (err) {
      setError(getErrorMessage(err));
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [formId, submittedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const refreshTimer = setInterval(() => {
      loadData();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(refreshTimer);
  }, [loadData]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(translate, { toValue: 0, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [fade, translate]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const saveSettings = async () => {
    if (!form) return;
    try {
      setBusy('settings');
      const updated = await formsService.update(form.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        form_slug: editSlug.trim(),
        is_public: editPublic,
        is_hidden: editHidden,
        collect_email: editCollectEmail,
        allow_multiple_responses: editMultiple,
      });
      setForm(updated);
      hydrateFormState(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!form) return;
    try {
      setBusy('publish');
      const updated = await formsService.publish(form.id);
      setForm(updated);
      hydrateFormState(updated);
      await loadVersions(updated.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const openPublishSchedule = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    setPublishScheduleAt(now);
    setIsPublishScheduleVisible(true);
  };

  const schedulePublish = async (scheduledAt?: Date) => {
    if (!form) return;
    const target = scheduledAt ?? publishScheduleAt;
    if (!target) {
      setError('Choose a valid publish date and time.');
      return;
    }

    try {
      setBusy('publish-schedule');
      const scheduled = await formsService.schedulePublish(form.id, { run_at: target.toISOString() });
      setScheduledActions((current) => [...current, scheduled].sort((left, right) => left.run_at.localeCompare(right.run_at)));
      setIsPublishScheduleVisible(false);
      Alert.alert('Scheduled', `This form will publish on ${formatScheduleDateTime(target)}.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const duplicate = async () => {
    if (!form) return;
    try {
      setBusy('duplicate');
      const copy = await formsService.duplicate(form.id);
      navigation.replace('FormDetail', { formId: copy.id });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const createQuestion = async () => {
    if (!questionTitle.trim()) {
      setError('Question title is required.');
      return;
    }

    const payload = {
      form_id: formId,
      branch_id: selectedBranchId,
      title: questionTitle.trim(),
      question_type: questionType,
      placeholder: questionPlaceholder.trim() || null,
      required: questionRequired,
      order_index: questions.length,
      options: optionType
        ? questionOptions
            .map((option, index) => ({ option_text: option.trim(), order_index: index }))
            .filter((option) => option.option_text.length > 0)
        : [],
    };

    const wasPublished = form?.status.toLowerCase() === 'published';
    const nextVersionNumber = formVersions.length + 1;

    try {
      setBusy('question');
      if (editingQuestionId) {
        const updated = await questionsService.update(editingQuestionId, {
          title: payload.title,
          question_type: payload.question_type,
          placeholder: payload.placeholder,
          required: payload.required,
          order_index: questions.findIndex((q) => q.id === editingQuestionId),
          branch_id: selectedBranchId,
          options: payload.options,
        });
        setQuestions((current) => current.map((question) => (question.id === updated.id ? updated : question)));
      } else {
        const created = await questionsService.create(payload);
        setQuestions((current) => [...current, created]);
      }

      setQuestionTitle('');
      setQuestionPlaceholder(getDefaultPlaceholder('short_text'));
      setQuestionType('short_text');
      setQuestionOptions(['Option 1', 'Option 2']);
      setQuestionRequired(false);
      setEditingQuestionId(null);
      setSelectedBranchId(null);

      const loadedForm = await loadData();
      if (wasPublished && loadedForm?.status.toLowerCase() !== 'published') {
        showDraftVersionNotice(nextVersionNumber);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const editQuestion = (question: QuestionItem) => {
    setEditingQuestionId(question.id);
    setQuestionTitle(question.title);
    setQuestionPlaceholder(question.placeholder || getDefaultPlaceholder(question.question_type));
    setQuestionType(question.question_type);
    setQuestionRequired(question.required);
    setQuestionOptions(question.options.length ? question.options.map((option) => option.option_text) : ['Option 1', 'Option 2']);
    setSelectedBranchId(question.branch_id);
  };

  const deleteQuestion = async (questionId: string) => {
    try {
      setBusy(questionId);
      await questionsService.delete(questionId);
      setQuestions((current) => current.filter((question) => question.id !== questionId));
      if (selectedQuestionId === questionId) {
        setSelectedQuestionId(null);
      }
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const openConditionsModal = (question: QuestionItem) => {
    navigation.navigate('FormConditions', { formId, questionId: question.id });
  };

  const getBranchTriggerOptions = (question: QuestionItem) => {
    if (question.question_type === 'yes_no' && question.options.length === 0) {
      return ['Yes', 'No'];
    }
    return question.options.map((option) => option.option_text);
  };

  const openBranchBuilder = (question: QuestionItem) => {
    navigation.navigate('BranchDetail', { formId, triggerQuestionId: question.id });
  };

  const createBranch = async () => {
    const triggerQuestion = questions.find((question) => question.id === selectedQuestionId);
    if (!triggerQuestion) {
      setError('Select a trigger question before creating a branch.');
      return;
    }
    if (!branchTriggerOption.trim()) {
      setError('Choose an option for the branch trigger.');
      return;
    }
    if (!branchTitle.trim()) {
      setError('Branch title is required.');
      return;
    }

    try {
      setBusy('branch');
      const created = await questionBranchesService.create({
        form_id: formId,
        trigger_question_id: triggerQuestion.id,
        trigger_option_text: branchTriggerOption.trim(),
        title: branchTitle.trim(),
        description: branchDescription.trim() || null,
        order_index: branches.filter((branch) => branch.trigger_question_id === triggerQuestion.id).length,
      });
      setBranches((current) => [...current, created]);
      setBranchTitle('');
      setBranchDescription('');
      setBranchTriggerOption(getBranchTriggerOptions(triggerQuestion)[0] ?? '');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const createFollowupQuestion = async () => {
    if (!conditionsQuestionId || (followupNeedsValue && !followupConditionValue)) {
      setError('Choose or enter the condition value before adding follow-up questions.');
      return;
    }
    if (!questionTitle.trim()) {
      setError('Question title is required.');
      return;
    }

    const payload = {
      form_id: formId,
      title: questionTitle.trim(),
      question_type: questionType,
      placeholder: questionPlaceholder.trim() || null,
      required: questionRequired,
      order_index: questions.length,
      options: optionType
        ? questionOptions
            .map((option, index) => ({ option_text: option.trim(), order_index: index }))
            .filter((option) => option.option_text.length > 0)
        : [],
    };

    try {
      setBusy('condition-followup');
      const createdQuestion = await questionsService.create(payload);
      const createdRule = await conditionalRulesService.create({
        form_id: formId,
        trigger_field_id: conditionsQuestionId,
        trigger_operator: followupOperator,
        trigger_value: followupNeedsValue ? followupConditionValue : null,
        target_field_id: createdQuestion.id,
        target_action: 'show',
      });

      setQuestions((current) => [...current, createdQuestion]);
      setRules((current) => [...current, createdRule]);
      setQuestionTitle('');
      setQuestionPlaceholder(getDefaultPlaceholder('short_text'));
      setQuestionType('short_text');
      setQuestionOptions(['Option 1', 'Option 2']);
      setQuestionRequired(false);
      setShowFollowupBuilder(false);
      setSelectedQuestionId(createdQuestion.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteConditionChild = async (childQuestionId: string) => {
    try {
      setBusy(childQuestionId);
      await questionsService.delete(childQuestionId);
      setQuestions((current) => current.filter((question) => question.id !== childQuestionId));
      setRules((current) => current.filter((rule) => rule.target_field_id !== childQuestionId));
      if (selectedQuestionId === childQuestionId) {
        setSelectedQuestionId(null);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const createRule = async () => {
    if (questions.length < 2) {
      setError('Create at least two questions before adding conditional logic.');
      return;
    }
    if (!ruleTriggerQuestionId || !ruleTargetQuestionId || !ruleAction) {
      setError('Pick a trigger question, an action, and a target question before saving the rule.');
      return;
    }
    if (ruleTriggerQuestionId === ruleTargetQuestionId) {
      setError('The trigger question and target question must be different.');
      return;
    }
    if (shouldRuleUseValue(ruleOperator) && !ruleValue.trim()) {
      setError('Enter a comparison value before saving this rule.');
      return;
    }

    try {
      setBusy('rule');
      const created = await conditionalRulesService.create({
        form_id: formId,
        trigger_field_id: ruleTriggerQuestionId,
        trigger_operator: ruleOperator,
        trigger_value: shouldRuleUseValue(ruleOperator) ? ruleValue.trim() || null : null,
        target_field_id: ruleTargetQuestionId,
        target_action: ruleAction,
      });
      setRules((current) => [...current, created]);
      setRuleValue('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      setBusy(ruleId);
      await conditionalRulesService.delete(ruleId);
      setRules((current) => current.filter((rule) => rule.id !== ruleId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteResponse = async (responseId: string) => {
    try {
      setBusy(responseId);
      await responsesService.delete(responseId);
      setResponses((current) => current.filter((response) => response.id !== responseId));
      setFormAnalytics((current) => current ? { ...current, responses: current.responses.filter((response) => response.id !== responseId), total_responses: Math.max(0, current.total_responses - 1) } : current);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const deleteCurrentForm = async () => {
    if (!form) return;
    try {
      setBusy('delete');
      await formsService.delete(form.id);
      navigation.replace('FormsList');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteForm = () => {
    if (!form) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Delete "${form.title}" and its responses?`);
      if (confirmed) {
        deleteCurrentForm();
      }
      return;
    }

    Alert.alert('Delete form', `Delete "${form.title}" and its responses?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: deleteCurrentForm,
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.backgroundLayer} pointerEvents="none">
        <View style={styles.bgGlowOne} />
        <View style={styles.bgGlowTwo} />
        <View style={styles.bgGlowThree} />
      </View>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[local.blue]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.internalHeader}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.86} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('FormsList'))}>
            <Feather name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.internalHeaderCopy}>
            <Text style={styles.pageEyebrow}>Form workspace</Text>
            <Text style={styles.pageTitle}>{form?.title ?? 'Untitled form'}</Text>
          </View>
          <View style={styles.headerPill}>
            <Feather name={form?.is_public ? 'globe' : 'lock'} size={14} color="#FFFFFF" />
            <Text style={styles.headerPillText}>{form?.is_public ? 'Public' : 'Private'}</Text>
          </View>
        </View>

        <View style={styles.pageHeader}>
          <View style={styles.pageHeadline}>
            <Text style={styles.pageEyebrow}>Workspace overview</Text>
            <Text style={styles.pageSummary}>
              {form?.is_public ? 'Public form live across the workspace.' : 'Private draft ready for editing and review.'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <StatusBadge status={form?.status ?? 'Draft'} />
            <Text style={styles.statusHint}>{form?.is_public ? 'Public access enabled' : 'Private preview only'}</Text>
          </View>
        </View>
        {loading && !refreshing ? <ActivityIndicator style={styles.loader} size="large" color={local.blue} /> : null}
        {error ? <Message text={error} onDismiss={() => setError(null)} /> : null}

        {form ? (
          <Animated.View style={{ opacity: fade, transform: [{ translateY: translate }] }}>
          <Modal
            transparent
            visible={isConditionsModalVisible}
            animationType="slide"
            onRequestClose={() => setIsConditionsModalVisible(false)}
          >
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Conditions</Text>
                    <TouchableOpacity onPress={() => setIsConditionsModalVisible(false)}>
                      <Text style={styles.modalClose}>Done</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalLabel}>Question</Text>
                  <Text style={styles.modalQuestionTitle}>{conditionsQuestion?.title ?? 'Select a question'}</Text>

                  <Text style={styles.modalLabel}>When answer</Text>
                  <View style={styles.logicPickerGrid}>
                    {CONDITIONAL_OPERATORS.map((operator) => (
                      <TouchableOpacity
                        key={operator.value}
                        style={[styles.logicChoiceChip, followupOperator === operator.value ? styles.logicChoiceChipActive : null]}
                        onPress={() => setFollowupOperator(operator.value)}
                      >
                        <Text style={[styles.logicChoiceText, followupOperator === operator.value ? styles.logicChoiceTextActive : null]}>{operator.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {followupNeedsValue && conditionAnswerOptions.length > 0 ? (
                    <>
                      <Text style={styles.modalLabel}>Compare with</Text>
                      <View style={styles.modalOptionList}>
                        {conditionAnswerOptions.map((option) => (
                          <TouchableOpacity
                            key={option.id}
                            style={[styles.modalOptionChip, selectedConditionOption === option.option_text ? styles.modalOptionChipActive : null]}
                            onPress={() => {
                              setSelectedConditionOption(option.option_text);
                              setShowFollowupBuilder(false);
                            }}
                          >
                            <Text style={[styles.modalOptionText, selectedConditionOption === option.option_text ? styles.modalOptionTextActive : null]}>{option.option_text}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  ) : followupNeedsValue ? (
                    <Field label="Compare value" value={followupValue} onChangeText={setFollowupValue} />
                  ) : null}

                  <View style={styles.modalSelectedCard}>
                    <Text style={styles.modalSelectedLabel}>Rule preview</Text>
                    <Text style={styles.modalSelectedValue}>
                      If {conditionsQuestion?.title ?? 'this question'} {getConditionalOperatorLabel(followupOperator).toLowerCase()}
                      {followupNeedsValue ? ` "${followupConditionValue || '...'}"` : ''}, show follow-up questions.
                    </Text>
                  </View>

                  {(!followupNeedsValue || followupConditionValue) ? (
                    <View style={styles.modalChildrenBlock}>
                      <Text style={styles.modalChildrenTitle}>Follow-up questions</Text>
                      {selectedConditionChildren.length === 0 ? (
                        <Text style={styles.helperText}>No follow-up questions yet for this answer.</Text>
                      ) : (
                        selectedConditionChildren.map((child, index) => (
                          <View key={child.id} style={styles.modalChildRow}>
                            <Text style={styles.modalChildIndex}>{index + 1}.</Text>
                            <Text style={styles.modalChildTitle}>{child.title}</Text>
                            <TouchableOpacity style={styles.deleteMini} onPress={() => deleteConditionChild(child.id)}>
                              <Text style={styles.deleteMiniText}>Del</Text>
                            </TouchableOpacity>
                          </View>
                        ))
                      )}
                      <TouchableOpacity style={styles.addOptionButton} onPress={() => setShowFollowupBuilder(true)}>
                        <Text style={styles.addOptionText}>+ Add Follow-up Question</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {showFollowupBuilder ? (
                    <View style={styles.modalBuilderCard}>
                      <Field label="Question title" value={questionTitle} onChangeText={setQuestionTitle} />
                      <Field label="Placeholder" value={questionPlaceholder} onChangeText={setQuestionPlaceholder} />
                      <Text style={styles.fieldLabel}>Type</Text>
                      <View style={styles.typeGrid}>
                        {questionTypes.map((type) => (
                          <TouchableOpacity
                            key={type.value}
                            style={[styles.typeChip, questionType === type.value ? styles.typeChipActive : null]}
                            onPress={() => {
                              setQuestionType(type.value);
                              setQuestionPlaceholder(getDefaultPlaceholder(type.value));
                              if (['radio', 'checkbox', 'dropdown'].includes(type.value) && questionOptions.length === 0) {
                                setQuestionOptions(['Option 1', 'Option 2']);
                              }
                            }}
                          >
                            <View style={styles.typeChipContent}>
                              <Feather name={type.icon} size={14} color={questionType === type.value ? '#FFFFFF' : local.muted} style={styles.typeIcon} />
                              <Text style={[styles.typeText, questionType === type.value ? styles.typeTextActive : null]}>{type.label}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {optionType ? (
                        <View style={styles.optionsBlock}>
                          <Text style={styles.fieldLabel}>{questionType === 'dropdown' ? 'Dropdown options' : 'Options'}</Text>
                          {questionOptions.map((option, index) => (
                            <View key={index} style={styles.optionRow}>
                              <View style={styles.optionEditorInputWrap}>
                                <OptionMarker type={questionType} index={index} />
                                <TextInput
                                  value={option}
                                  onChangeText={(value) => {
                                    const next = [...questionOptions];
                                    next[index] = value;
                                    setQuestionOptions(next);
                                  }}
                                  placeholder={`Option ${index + 1}`}
                                  placeholderTextColor="#5EA0FF"
                                  style={[styles.fieldInput, styles.optionInput]}
                                />
                              </View>
                              <TouchableOpacity
                                style={[styles.optionDelete, questionOptions.length <= 2 ? styles.optionDeleteDisabled : null]}
                                disabled={questionOptions.length <= 2}
                                onPress={() => {
                                  const next = questionOptions.filter((_, idx) => idx !== index);
                                  setQuestionOptions(next);
                                }}
                              >
                                <Text style={[styles.optionDeleteText, questionOptions.length <= 2 ? styles.optionDeleteTextDisabled : null]}>Del</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                          <TouchableOpacity style={styles.addOptionButton} activeOpacity={0.85} onPress={() => setQuestionOptions([...questionOptions, `Option ${questionOptions.length + 1}`])}>
                            <Text style={styles.addOptionText}>Add option</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                      <ToggleRow label="Required question" value={questionRequired} onChange={setQuestionRequired} />
                      <View style={styles.formActionRow}>
                        <LocalButton label="Save follow-up" variant="secondary" size="lg" isLoading={busy === 'condition-followup'} disabled={busy === 'condition-followup'} onPress={createFollowupQuestion} />
                      </View>
                    </View>
                  ) : null}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <View style={styles.hero}>
            <LinearGradient colors={['rgba(8,17,45,0.02)', 'rgba(18,43,111,0.02)', 'rgba(109,40,217,0.02)']} style={styles.heroBackground}>
              <View style={styles.heroTop}>
              <View style={styles.heroTitleWrap}>
                <Text style={styles.eyebrow}>Form workspace</Text>
                <Text style={styles.title}>{form.title}</Text>
                <Text style={styles.subtitle}>{form.description || 'No description provided.'}</Text>
              </View>
              <StatusBadge status={form.status} />
            </View>
            </LinearGradient>
            <View style={styles.heroActions}>
              {form.status.toLowerCase() !== 'published' ? (
                <Action label="Publish" icon="check-circle" loading={busy === 'publish'} onPress={publish} primary />
              ) : (
                <Action label="Send by email" icon="mail" onPress={() => navigation.navigate('FormShare', { formId: form.id })} primary />
              )}
              {form.status.toLowerCase() !== 'published' ? (
                <Action label="Schedule publish" icon="calendar" onPress={openPublishSchedule} />
              ) : null}
              <Action label="Preview" icon="eye" onPress={() => navigation.navigate('FormPreview', { formId: form.id })} />
              <Action label="Responses" icon="bar-chart-2" onPress={() => navigation.navigate('FormResponses', { formId: form.id })} />
              <Action label="Duplicate" icon="copy" loading={busy === 'duplicate'} onPress={duplicate} />
              <Action label="QR" icon="grid" onPress={() => void openQr()} />
            </View>

            {nextPublishSchedule ? (
              <View style={styles.scheduleNotice}>
                <Feather name="clock" size={16} color={local.blue} />
                <Text style={styles.scheduleNoticeText}>
                  Publish scheduled for {formatScheduleDateTime(new Date(nextPublishSchedule.run_at))}
                </Text>
              </View>
            ) : null}

            {form.is_public ? (
              <View style={[styles.linkPanel, { marginTop: 12, marginBottom: 12 }]}>
                <Text style={styles.linkLabel}>Public form endpoint</Text>
                <Text style={styles.linkValue}>{publicUrl}</Text>
              </View>
            ) : null}
          </View>

          <ScheduleDateTimePicker
            visible={isPublishScheduleVisible}
            title="Schedule publish"
            confirmLabel={busy === 'publish-schedule' ? 'Scheduling' : 'Schedule'}
            initialDate={publishScheduleAt}
            onCancel={() => setIsPublishScheduleVisible(false)}
            onConfirm={(date) => {
              setPublishScheduleAt(date);
              void schedulePublish(date);
            }}
          />

          <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
            <View style={styles.qrBackdrop}>
              <View style={styles.qrModal}>
                <View style={styles.qrModalHeader}>
                  <View>
                    <Text style={styles.qrEyebrow}>Public URL QR</Text>
                    <Text style={styles.qrTitle}>Scan to open the live form</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.qrCloseButton}
                    onPress={() => {
                      setQrVisible(false);
                      setQrSvg(null);
                    }}
                  >
                    <Feather name="x" size={18} color={local.muted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.qrDescription}>
                  This QR code points to the public form URL for {form.title}.
                </Text>

                <View style={styles.qrCodeCard}>
                  {qrLoading ? (
                    <ActivityIndicator size="large" color={local.blue} />
                  ) : qrSvg ? (
                    <SvgXml xml={qrSvg} width={250} height={250} />
                  ) : null}
                </View>

                <Text style={styles.qrUrlLabel}>Public URL</Text>
                <Text style={styles.qrUrlText} selectable>
                  {publicUrl}
                </Text>

                <View style={styles.qrActions}>
                  <TouchableOpacity style={styles.qrSecondaryButton} onPress={() => Linking.openURL(publicUrl)}>
                    <Text style={styles.qrSecondaryButtonText}>Open link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.qrPrimaryButton}
                    onPress={() => {
                      setQrVisible(false);
                      setQrSvg(null);
                    }}
                  >
                    <Text style={styles.qrPrimaryButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <View style={styles.statsGrid}>
            <StatBox label="Questions" value={questions.length.toString()} />
            <StatBox label="Responses" value={responseTotal.toString()} />
            <StatBox label="Avg time" value={`${averageCompletion}s`} />
            <StatBox label="Public" value={form.is_public ? 'Yes' : 'No'} />
          </View>

          <Panel title="Settings">
            <Field label="Title" value={editTitle} onChangeText={setEditTitle} />
            <Field label="Description" value={editDescription} onChangeText={setEditDescription} multiline />
            <Field label="Slug" value={editSlug} onChangeText={setEditSlug} autoCapitalize="none" />
            <ToggleRow label="Public access" value={editPublic} onChange={setEditPublic} />
            <ToggleRow label="Hide form from public view" value={editHidden} onChange={setEditHidden} />
            <ToggleRow label="Collect respondent email" value={editCollectEmail} onChange={setEditCollectEmail} />
            <ToggleRow label="Allow multiple responses" value={editMultiple} onChange={setEditMultiple} />
            <LocalButton label="Save settings" variant="primary" size="lg" isLoading={busy === 'settings'} disabled={busy === 'settings'} onPress={saveSettings} />
          </Panel>

          <View style={styles.fullColumn}>
              <View style={styles.versionSummary}>
                <Text style={styles.sectionTitle}>Current version</Text>
                {formVersions.length > 0 ? (
                  <View>
                    <Text style={styles.rowTitle}>Version {formVersions[0].version_number}</Text>
                    <Text style={styles.rowMeta}>{formVersions[0].status ?? (formVersions[0].is_published ? 'published' : 'draft')} · {new Date(formVersions[0].published_at || formVersions[0].updated_at || '').toLocaleDateString()}</Text>
                  </View>
                ) : (
                  <Text style={styles.helperText}>No published versions yet.</Text>
                )}
              </View>
              <Panel title="Question builder">
                <Field label="Question title" value={questionTitle} onChangeText={setQuestionTitle} />
                <Field label="Placeholder" value={questionPlaceholder} onChangeText={setQuestionPlaceholder} />
                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.typeGrid}>
                  {questionTypes.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[styles.typeChip, questionType === type.value ? styles.typeChipActive : null]}
                      onPress={() => {
                        setQuestionType(type.value);
                        setQuestionPlaceholder(getDefaultPlaceholder(type.value));
                        if (['radio', 'checkbox', 'dropdown'].includes(type.value) && questionOptions.length === 0) {
                          setQuestionOptions(['Option 1', 'Option 2']);
                        }
                      }}
                    >
                      <View style={styles.typeChipContent}>
                        <Feather
                          name={type.icon}
                          size={14}
                          color={questionType === type.value ? '#FFFFFF' : local.muted}
                          style={styles.typeIcon}
                        />
                        <Text style={[styles.typeText, questionType === type.value ? styles.typeTextActive : null]}>{type.label}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                {optionType ? (
                  <View style={styles.optionsBlock}>
                    <Text style={styles.fieldLabel}>{questionType === 'dropdown' ? 'Dropdown options' : 'Options'}</Text>
                    <View style={styles.optionPreviewBox}>
                      <Text style={styles.optionPreviewLabel}>Respondent preview</Text>
                      <QuestionTypePreview type={questionType} options={questionOptions} />
                    </View>
                    {questionOptions.map((option, index) => (
                      <View key={index} style={styles.optionRow}>
                        <View style={styles.optionEditorInputWrap}>
                          <OptionMarker type={questionType} index={index} />
                          <TextInput
                            value={option}
                            onChangeText={(value) => {
                              const next = [...questionOptions];
                              next[index] = value;
                              setQuestionOptions(next);
                            }}
                            placeholder={`Option ${index + 1}`}
                            placeholderTextColor="#5EA0FF"
                            style={[styles.fieldInput, styles.optionInput]}
                          />
                        </View>
                        <TouchableOpacity
                          style={[styles.optionDelete, questionOptions.length <= 2 ? styles.optionDeleteDisabled : null]}
                          disabled={questionOptions.length <= 2}
                          onPress={() => {
                            const next = questionOptions.filter((_, idx) => idx !== index);
                            setQuestionOptions(next);
                          }}
                        >
                          <Text style={[styles.optionDeleteText, questionOptions.length <= 2 ? styles.optionDeleteTextDisabled : null]}>Del</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                    <TouchableOpacity style={styles.addOptionButton} activeOpacity={0.85} onPress={() => setQuestionOptions([...questionOptions, `Option ${questionOptions.length + 1}`])}>
                      <Text style={styles.addOptionText}>Add option</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                <ToggleRow label="Required question" value={questionRequired} onChange={setQuestionRequired} />
                <View style={styles.formActionRow}>
                  <LocalButton label={editingQuestionId ? 'Save question' : 'Add question'} variant="secondary" size="lg" isLoading={busy === 'question'} disabled={busy === 'question'} onPress={createQuestion} />
                  {editingQuestionId ? (
                    <TouchableOpacity style={styles.cancelButton} onPress={() => {
                      setEditingQuestionId(null);
                      setQuestionTitle('');
                      setQuestionPlaceholder(getDefaultPlaceholder('short_text'));
                      setQuestionType('short_text');
                      setQuestionOptions(['Option 1', 'Option 2']);
                      setQuestionRequired(false);
                    }}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </Panel>

              <Panel title="Conditional logic">
                {questions.length < 2 ? (
                  <Text style={styles.helperText}>Add at least two questions to create show, hide, or required rules.</Text>
                ) : (
                  <View style={styles.logicBuilder}>
                    <Text style={styles.logicPickerTitle}>If this question</Text>
                    <View style={styles.logicPickerGrid}>
                      {questions.map((question) => (
                        <TouchableOpacity
                          key={question.id}
                          style={[styles.logicChoiceChip, ruleTriggerQuestionId === question.id ? styles.logicChoiceChipActive : null]}
                          onPress={() => setRuleTriggerQuestionId(question.id)}
                        >
                          <Text style={[styles.logicChoiceText, ruleTriggerQuestionId === question.id ? styles.logicChoiceTextActive : null]} numberOfLines={2}>{question.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.logicPickerTitle}>Matches like this</Text>
                    <View style={styles.logicPickerGrid}>
                      {CONDITIONAL_OPERATORS.map((operator) => (
                        <TouchableOpacity
                          key={operator.value}
                          style={[styles.logicChoiceChip, ruleOperator === operator.value ? styles.logicChoiceChipActive : null]}
                          onPress={() => setRuleOperator(operator.value)}
                        >
                          <Text style={[styles.logicChoiceText, ruleOperator === operator.value ? styles.logicChoiceTextActive : null]}>{operator.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {shouldRuleUseValue(ruleOperator) ? (
                      <Field label="Compare value" value={ruleValue} onChangeText={setRuleValue} />
                    ) : null}

                    <Text style={styles.logicPickerTitle}>Then do this</Text>
                    <View style={styles.logicPickerGrid}>
                      {CONDITIONAL_ACTIONS.map((action) => (
                        <TouchableOpacity
                          key={action.value}
                          style={[styles.logicChoiceChip, ruleAction === action.value ? styles.logicChoiceChipActive : null]}
                          onPress={() => setRuleAction(action.value)}
                        >
                          <Text style={[styles.logicChoiceText, ruleAction === action.value ? styles.logicChoiceTextActive : null]}>{action.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.logicPickerTitle}>Target question</Text>
                    <View style={styles.logicPickerGrid}>
                      {questions.filter((question) => question.id !== ruleTriggerQuestionId).map((question) => (
                        <TouchableOpacity
                          key={question.id}
                          style={[styles.logicChoiceChip, ruleTargetQuestionId === question.id ? styles.logicChoiceChipActive : null]}
                          onPress={() => setRuleTargetQuestionId(question.id)}
                        >
                          <Text style={[styles.logicChoiceText, ruleTargetQuestionId === question.id ? styles.logicChoiceTextActive : null]} numberOfLines={2}>{question.title}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.logicPreviewCard}>
                      <Text style={styles.logicPreviewTitle}>Preview</Text>
                      <Text style={styles.logicPreviewText}>{currentRulePreview.sentence}</Text>
                    </View>
                    <LocalButton label="Add rule" variant="secondary" size="lg" isLoading={busy === 'rule'} disabled={busy === 'rule'} onPress={createRule} />
                  </View>
                )}

                {rules.length > 0 ? (
                  <View style={styles.listBlock}>
                    <Text style={styles.logicPickerTitle}>Active rules</Text>
                    {rules.map((rule) => (
                      <View key={rule.id} style={styles.ruleRow}>
                        <Text style={styles.logicPreviewText}>{describeConditionalRule(rule, questionLabelMap).sentence}</Text>
                        <TouchableOpacity style={[styles.deleteMini, styles.ruleDeleteButton]} onPress={() => deleteRule(rule.id)}>
                          <Text style={styles.deleteMiniText}>Delete rule</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Panel>

              <Panel title="Saved questions">
                {questions.length === 0 ? (
                  <Empty text="No saved questions yet." />
                ) : (
                  questions.map((question, index) => {
                    const relatedRules = (questionRules.get(question.id) ?? []).filter((rule) => rule.target_action === 'show');
                    const questionBranches = branchesByQuestion.get(question.id) ?? [];
                    const questionBranch = branches.find((branch) => branch.id === question.branch_id) ?? null;
                    const followupGroups = relatedRules.reduce<Record<string, QuestionItem[]>>((groups, rule) => {
                      const optionText = (rule.trigger_value ?? '').trim() || 'default';
                      const childQuestion = questions.find((candidate) => candidate.id === rule.target_field_id);
                      if (!childQuestion) return groups;
                      const nextGroup = groups[optionText] ?? [];
                      nextGroup.push(childQuestion);
                      groups[optionText] = nextGroup;
                      return groups;
                    }, {});
                    const hasFollowups = relatedRules.length > 0;
                    const isExpanded = expandedFollowupQuestionId === question.id;

                    return (
                      <View key={question.id} style={styles.questionRow}>
                        <View style={styles.indexBadge}><Text style={styles.indexText}>{index + 1}</Text></View>
                        <View style={styles.rowCopy}>
                          <Text style={styles.rowTitle}>{question.title}</Text>
                          <View style={styles.rowMetaTags}>
                            <MetaTag icon={getQuestionTypeIcon(question.question_type)} label={getQuestionTypeLabel(question.question_type)} />
                            <MetaTag icon={question.required ? 'check-circle' : 'circle'} label={question.required ? 'Required' : 'Optional'} />
                            {questionBranch ? <MetaTag icon="corner-down-right" label={`Branch: ${questionBranch.title}`} /> : null}
                            {['radio', 'checkbox', 'dropdown'].includes(question.question_type) ? <MetaTag icon="list" label={`${question.options.length} option${question.options.length === 1 ? '' : 's'}`} /> : null}
                          </View>
                          <View style={styles.rowActions}>
                            <TouchableOpacity style={styles.questionActionButton} onPress={() => editQuestion(question)}>
                              <Text style={styles.questionActionText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.questionActionButton, styles.questionActionDanger]} onPress={() => deleteQuestion(question.id)}>
                              <Text style={[styles.questionActionText, styles.questionActionDangerText]}>Delete</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.questionActionButton}
                              onPress={() => openConditionsModal(question)}
                            >
                              <Text style={styles.questionActionText}>Conditions</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.questionActionButton}
                              onPress={() => openBranchBuilder(question)}
                            >
                              <Text style={styles.questionActionText}>Branch</Text>
                            </TouchableOpacity>
                          </View>
                          {hasFollowups ? (
                            <TouchableOpacity onPress={() => setExpandedFollowupQuestionId(isExpanded ? null : question.id)}>
                              <Text style={styles.ruleBadge}>{relatedRules.length} follow-up {relatedRules.length === 1 ? 'question' : 'questions'}</Text>
                            </TouchableOpacity>
                          ) : (
                            <Text style={styles.ruleBadge}>{relatedRules.length} follow-up {relatedRules.length === 1 ? 'question' : 'questions'}</Text>
                          )}

                          {isExpanded ? (
                            <View style={styles.followupExpansion}>
                              {Object.entries(followupGroups).map(([optionText, children]) => (
                                <View key={`${question.id}-${optionText}`} style={styles.followupGroupCard}>
                                  <Text style={styles.followupGroupHeader}>{optionText}</Text>
                                  {children.map((child) => (
                                    <Text key={child.id} style={styles.followupGroupItem}>• {child.title}</Text>
                                  ))}
                                </View>
                              ))}
                            </View>
                          ) : null}

                        </View>
                      </View>
                    );
                  })
                )}
              </Panel>

              <View style={styles.dangerPanel}>
                <View style={styles.dangerCopy}>
                  <Text style={styles.dangerTitle}>Delete this form</Text>
                  <Text style={styles.dangerText}>This removes the form, questions, and related responses.</Text>
                </View>
                <LocalButton label="Delete" variant="danger" size="sm" isLoading={busy === 'delete'} disabled={busy === 'delete'} onPress={handleDeleteForm} />
              </View>
            </View>

          

          <Panel title="Form versions">
            {versionsLoading ? (
              <Text style={styles.helperText}>Loading versions…</Text>
            ) : formVersions.length === 0 ? (
              <Empty text="No published versions yet." />
            ) : (
              formVersions.map((version) => (
                <View key={version.id} style={styles.versionRow}>
                  <View>
                    <Text style={styles.rowTitle}>Version {version.version_number}</Text>
                    <Text style={styles.rowMeta}>{version.status ?? (version.is_published ? 'published' : 'draft')} · {new Date(version.published_at || version.updated_at || '').toLocaleDateString()}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.versionDetailButton}
                    onPress={() => navigation.navigate('FormVersionDetail', { formId: form.id, versionNumber: version.version_number })}
                  >
                    <Text style={styles.versionDetailText}>View</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </Panel>

          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const shortId = (id?: string | null) => id ? id.slice(0, 8) : 'deleted';

const Message: React.FC<{ text: string; onDismiss: () => void }> = ({ text, onDismiss }) => (
  <TouchableOpacity style={styles.errorBox} onPress={onDismiss}>
    <Text style={styles.errorText}>{text}</Text>
  </TouchableOpacity>
);

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.panel}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const Action: React.FC<{ label: string; onPress: () => void; primary?: boolean; loading?: boolean; icon?: React.ComponentProps<typeof Feather>['name'] }> = ({ label, onPress, primary, loading, icon }) => (
  <TouchableOpacity
    style={[styles.action, primary ? styles.actionPrimary : null]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.86}
    accessible
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    {loading ? (
      <ActivityIndicator color={primary ? '#FFFFFF' : local.ink} />
    ) : (
      <>
        {icon ? <Feather name={icon} size={15} color={primary ? '#FFFFFF' : local.blue} /> : null}
        <Text style={[styles.actionText, primary ? styles.actionTextPrimary : null, icon ? styles.actionTextWithIcon : null]}>{label}</Text>
      </>
    )}
  </TouchableOpacity>
);

const LocalButton: React.FC<{
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  disabled?: boolean;
}> = ({ label, onPress, variant = 'primary', size = 'md', isLoading, disabled }) => {
  const isOutline = variant === 'outline';
  const isDanger = variant === 'danger';
  const isDisabled = isLoading || disabled;

  return (
    <TouchableOpacity
      style={[
        styles.localButton,
        size === 'sm' ? styles.localButtonSm : size === 'lg' ? styles.localButtonLg : styles.localButtonMd,
        isOutline ? styles.localButtonOutline : isDanger ? styles.localButtonDanger : styles.localButtonPrimary,
        isDisabled ? styles.localButtonDisabled : null,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.86}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {isLoading ? (
        <ActivityIndicator color={isOutline ? local.red : '#FFFFFF'} />
      ) : (
        <Text style={[styles.localButtonText, isOutline ? styles.localButtonTextOutline : null]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

const Field: React.FC<{ label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' }> = ({ label, value, onChangeText, multiline, autoCapitalize = 'sentences' }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
      placeholderTextColor="#5EA0FF"
      style={[styles.fieldInput, multiline ? styles.fieldInputTall : null]}
      accessible
      accessibilityLabel={label}
    />
  </View>
);

const ToggleRow: React.FC<{ label: string; value: boolean; onChange: (value: boolean) => void }> = ({ label, value, onChange }) => (
  <View style={styles.toggleRow}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <Switch value={value} onValueChange={onChange} trackColor={{ false: '#D0D5DD', true: '#EDE9FE' }} thumbColor={value ? local.blue : '#FFFFFF'} />
  </View>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const published = status.toLowerCase() === 'published';
  return (
    <View style={[styles.statusBadge, published ? styles.statusLive : styles.statusDraft]}>
      <Text style={[styles.statusBadgeText, published ? styles.statusLiveText : styles.statusDraftText]}>{published ? 'Published' : status}</Text>
    </View>
  );
};

const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statBox}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const OptionMarker: React.FC<{ type: QuestionType; index: number }> = ({ type, index }) => {
  if (type === 'checkbox') {
    return <View style={styles.checkboxMarker} />;
  }

  if (type === 'radio') {
    return <View style={styles.radioMarker} />;
  }

  if (type === 'dropdown') {
    return <View style={styles.dropdownIndexMarker}><Text style={styles.dropdownIndexText}>{index + 1}</Text></View>;
  }

  return null;
};

const QuestionTypePreview: React.FC<{ type: QuestionType; options: string[] }> = ({ type, options }) => {
  const visibleOptions = options.map((option) => option.trim()).filter(Boolean);

  if (type === 'date') {
    return (
      <View style={styles.previewDateCard}>
        <Feather name="calendar" size={14} color={local.blue} style={styles.metaTagIcon} />
        <Text style={styles.previewDateText}>Date picker preview</Text>
      </View>
    );
  }

  if (type === 'file_upload') {
    return (
      <View style={styles.previewDateCard}>
        <Feather name="upload-cloud" size={14} color={local.blue} style={styles.metaTagIcon} />
        <Text style={styles.previewDateText}>File upload preview</Text>
      </View>
    );
  }

  if (type === 'dropdown') {
    return (
      <View style={styles.dropdownPreviewControl}>
        <Text style={styles.dropdownPreviewValue}>{visibleOptions[0] || 'Choose'}</Text>
        <Text style={styles.dropdownPreviewArrow}>⌄</Text>
      </View>
    );
  }

  return (
    <View>
      {visibleOptions.slice(0, 3).map((option, index) => (
        <View key={`${type}-${option}-${index}`} style={styles.previewOptionLine}>
          {type === 'checkbox' ? <View style={styles.checkboxMarker} /> : <View style={styles.radioMarker} />}
          <Text style={styles.previewOptionText}>{option}</Text>
        </View>
      ))}
    </View>
  );
};

const SavedQuestionPreview: React.FC<{ question: QuestionItem }> = ({ question }) => {
  if (!['radio', 'checkbox', 'dropdown', 'date', 'file_upload'].includes(question.question_type)) {
    return null;
  }

  const optionLabels = question.options.map((option) => option.option_text);
  return (
    <View style={styles.savedPreview}>
      <QuestionTypePreview type={question.question_type} options={optionLabels} />
    </View>
  );
};

const getQuestionTypeLabel = (type: QuestionType) => {
  const typeMapping = questionTypes.find((item) => item.value === type);
  return typeMapping ? typeMapping.label : 'Field';
};

const getQuestionTypeIcon = (type: QuestionType) => {
  const typeMapping = questionTypes.find((item) => item.value === type);
  return typeMapping ? typeMapping.icon : 'circle';
};

const MetaTag: React.FC<{ icon: React.ComponentProps<typeof Feather>['name']; label: string }> = ({ icon, label }) => (
  <View style={styles.metaTag}>
    <Feather name={icon} size={12} color={local.blue} style={styles.metaTagIcon} />
    <Text style={styles.metaTagText}>{label}</Text>
  </View>
);

const QuestionAnalyticsCard: React.FC<{ question: FormAnalytics['questions'][number] }> = ({ question }) => {
  const isChoice = question.options.length > 0;
  const optionRows = question.options.map((option) => ({ label: option.option, value: option.count }));

  return (
    <View style={styles.analyticsCard}>
      <View style={styles.analyticsHeader}>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{question.title}</Text>
          <Text style={styles.rowMeta}>{question.total_answers} answered · {question.skipped} skipped · {question.question_type}</Text>
        </View>
        {question.average_rating !== null ? (
          <View style={styles.ratingBadge}><Text style={styles.ratingBadgeText}>{question.average_rating}/5</Text></View>
        ) : null}
      </View>

      {isChoice ? (
        <HorizontalBarChart
          title="Answer distribution"
          rows={optionRows}
          subtitle="How respondents selected each option."
          emptyLabel="No answer values yet."
        />
      ) : question.text_answers.length > 0 ? (
        <View style={styles.answerPreviewList}>
          {question.text_answers.map((answer, index) => (
            <Text key={`${question.question_id}-${index}`} style={styles.answerPreviewText} numberOfLines={2}>“{answer}”</Text>
          ))}
        </View>
      ) : (
        <Text style={styles.helperText}>No answer values yet.</Text>
      )}
    </View>
  );
};

const ResponseDetailCard: React.FC<{
  response: ResponseItem;
  detail?: FormAnalytics['responses'][number];
  fallbackIndex: number;
  onDelete: () => void;
}> = ({ response, detail, fallbackIndex, onDelete }) => {
  const label = detail?.respondent_label || response.respondent_email || response.submitted_by || `Anonymous #${fallbackIndex}`;
  const answers = detail?.answers ?? [];

  return (
    <View style={styles.responseDetailCard}>
      <View style={styles.responseDetailTop}>
        <View style={styles.responseAvatar}><Text style={styles.responseAvatarText}>{label.charAt(0).toUpperCase()}</Text></View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{label}</Text>
          <Text style={styles.rowMeta}>
            {new Date(response.submitted_at).toLocaleString()} · {response.answers.length} answers
            {response.completion_time ? ` · ${Math.round(response.completion_time)}s` : ''}
          </Text>
          {response.device || response.browser ? <Text style={styles.rowMeta}>{[response.device, response.browser].filter(Boolean).join(' · ')}</Text> : null}
        </View>
        <TouchableOpacity style={styles.deleteMini} onPress={onDelete}><Text style={styles.deleteMiniText}>Del</Text></TouchableOpacity>
      </View>

      {answers.length > 0 ? (
        <View style={styles.answerTable}>
          {answers.map((answer) => (
            <View key={`${response.id}-${answer.question_id}`} style={styles.answerRow}>
              <Text style={styles.answerQuestion}>{answer.question_title}</Text>
              <Text style={styles.answerValue}>{formatAnswerValues(answer.values, answer.answer)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.answerTable}>
          {response.answers.map((answer) => (
            <View key={answer.id} style={styles.answerRow}>
              <Text style={styles.answerQuestion}>{shortId(answer.question_id)}</Text>
              <Text style={styles.answerValue}>{answer.answer || 'No answer'}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const formatAnswerValues = (values: string[], fallback: string | null) => {
  if (values.length > 0) return values.join(', ');
  return fallback || 'No answer';
};

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.emptyState}><Text style={styles.emptyText}>{text}</Text></View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F5FF', position: 'relative' },
  backgroundLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  container: { flex: 1, backgroundColor: 'transparent' },
  bgGlowOne: { position: 'absolute', top: -70, left: -90, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(91, 75, 255, 0.16)' },
  bgGlowTwo: { position: 'absolute', top: 140, right: -110, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(46, 166, 255, 0.14)' },
  bgGlowThree: { position: 'absolute', bottom: -120, left: '16%', width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(168, 111, 255, 0.10)' },
  content: { padding: 16, paddingBottom: 30, alignItems: 'center' },
  loader: { marginVertical: 24 },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', padding: 12, marginBottom: 12 },
  errorText: { color: local.red, fontWeight: '700' },
  internalHeader: { width: '100%', maxWidth: 980, flexDirection: 'row', alignItems: 'center', marginBottom: 14, padding: 14, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.76)', borderWidth: 1, borderColor: cardBorder, shadowColor: 'rgba(91, 75, 255, 0.10)', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 10 },
  backButton: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(91, 75, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.12)' },
  internalHeaderCopy: { flex: 1, paddingHorizontal: 14 },
  headerPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: 'rgba(91, 75, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.12)', paddingHorizontal: 12, paddingVertical: 8 },
  headerPillText: { marginLeft: 6, color: local.blue, fontSize: 12, fontWeight: '900' },
  headerPillTextPublic: { color: local.green },
  pageHeader: { width: '100%', maxWidth: 980, backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 28, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: cardBorder, shadowColor: 'rgba(91, 75, 255, 0.10)', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4 },
  pageHeadline: { alignItems: 'center' },
  pageEyebrow: { color: '#5B4BFF', fontWeight: '700', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  pageSummary: { color: local.ink, fontSize: 20, fontWeight: '800', lineHeight: 28, textAlign: 'center' },
  pageTitle: { color: local.ink, fontSize: 26, fontWeight: '800', lineHeight: 34, textAlign: 'center' },
  statusRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  statusHint: { color: local.muted, fontSize: 13, marginLeft: 12 },
  hero: { backgroundColor: 'rgba(255,255,255,0.84)', borderRadius: 24, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: cardBorder, shadowColor: 'rgba(91, 75, 255, 0.10)', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4 },
  heroTop: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  heroTitleWrap: { width: '100%', marginBottom: 16 },
  eyebrow: { color: local.blue, fontWeight: '700', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', textAlign: 'center' },
  title: { color: local.ink, fontSize: 22, fontWeight: '800', marginTop: 6, lineHeight: 28 },
  subtitle: { color: local.muted, lineHeight: 21, marginTop: 10 },
  heroActions: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 },
  scheduleNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, backgroundColor: '#EEF4FF', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  scheduleNoticeText: { color: local.blue, fontWeight: '700', marginLeft: 8, flexShrink: 1 },
  action: { width: 160, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: local.line, backgroundColor: '#F7F1FF', alignItems: 'center', justifyContent: 'center', marginRight: 10, marginBottom: 10, paddingHorizontal: 16, flexDirection: 'row' },
  actionPrimary: { backgroundColor: local.blue, borderColor: local.blue },
  actionText: { color: local.ink, fontWeight: '700' },
  actionTextPrimary: { color: '#FFFFFF' },
  actionTextWithIcon: { marginLeft: 8 },
  localButton: { borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, alignSelf: 'center', minWidth: 180, maxWidth: 320 },
  localButtonSm: { minHeight: 38, paddingHorizontal: 18 },
  localButtonMd: { minHeight: 46, paddingHorizontal: 20 },
  localButtonLg: { minHeight: 52, paddingHorizontal: 24 },
  localButtonPrimary: { backgroundColor: local.blue, borderColor: local.blue },
  localButtonDanger: { backgroundColor: local.red, borderColor: local.red },
  localButtonOutline: { backgroundColor: '#F7F1FF', borderColor: local.line },
  localButtonDisabled: { opacity: 0.65 },
  localButtonText: { color: '#FFFFFF', fontWeight: '700' },
  localButtonTextOutline: { color: local.red },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  statusLive: { backgroundColor: 'rgba(52, 199, 89, 0.1)' },
  statusDraft: { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  statusLiveText: { color: local.green },
  statusDraftText: { color: local.amber },
  heroBackground: { borderRadius: 16, padding: 18 },
  statValue: { color: local.ink, fontSize: 24, fontWeight: '800' },
  metaTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: local.soft, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, marginRight: 8, marginBottom: 8 },
  metaTagIcon: { marginRight: 4 },
  metaTagText: { color: local.blue, fontSize: 11, fontWeight: '700' },
  statsGrid: { width: '100%', maxWidth: 980, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 4 },
  responseSummaryGrid: { width: '100%', maxWidth: 980, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 },
  columns: { width: '100%', maxWidth: 980, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap' },
  leftColumn: { flex: 2, minWidth: 280, maxWidth: 620, marginRight: 12 },
  rightColumn: { flex: 1, minWidth: 280, maxWidth: 320 },
  statBox: { width: '45%', maxWidth: 220, backgroundColor: '#FBF7FF', borderRadius: 18, padding: 14, marginRight: 8, marginBottom: 10, borderWidth: 1, borderColor: cardBorder, shadowColor: 'rgba(15, 23, 42, 0.08)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  statLabel: { color: local.muted, fontSize: 12, fontWeight: '600', marginTop: 3 },
  panel: { width: '100%', maxWidth: 980, alignSelf: 'center', backgroundColor: '#FBF7FF', borderRadius: 22, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: cardBorder, shadowColor: 'rgba(15, 23, 42, 0.08)', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 3 },
  sectionTitle: { color: local.ink, fontSize: 16, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  sectionEyebrow: { color: local.blue, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 10, textAlign: 'center' },
  field: { marginBottom: 12 },
  fieldLabel: { color: local.ink, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  fieldInput: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: local.ink,
    fontSize: 16,
    borderWidth: 1,
    borderColor: cardBorder,
    ...webInputReset,
  },
  fieldInputTall: { minHeight: 92, textAlignVertical: 'top', paddingTop: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: local.line },
  toggleLabel: { color: local.ink, fontWeight: '900' },
  linkPanel: { backgroundColor: local.soft, borderRadius: 16, padding: 12, marginBottom: 12 },
  linkLabel: { color: local.muted, fontSize: 12, fontWeight: '900', marginBottom: 5 },
  linkValue: { color: local.ink, fontWeight: '800' },
  qrBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  qrModal: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#FBF7FF',
    borderWidth: 1,
    borderColor: cardBorder,
    shadowColor: 'rgba(15, 23, 42, 0.12)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  qrEyebrow: {
    color: local.blue,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  qrTitle: {
    color: local.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  qrCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  qrDescription: {
    marginTop: 10,
    color: local.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  qrCodeCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: local.line,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  qrUrlLabel: {
    marginTop: 14,
    color: local.blue,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  qrUrlText: {
    marginTop: 6,
    color: local.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  qrActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  qrSecondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    borderWidth: 1,
    borderColor: local.line,
  },
  qrSecondaryButtonText: {
    color: local.blue,
    fontSize: 13,
    fontWeight: '900',
  },
  qrPrimaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: local.blue,
  },
  qrPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  twoActions: { flexDirection: 'row' },
  versionsLoader: { marginVertical: 8 },
  versionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: local.line },
  versionLabel: { color: local.ink, fontWeight: '900' },
  versionMeta: { color: local.muted, fontSize: 12, marginTop: 3 },
  versionStatus: { color: local.green, fontSize: 12, fontWeight: '900' },
  versionNotice: { color: local.blue, fontSize: 12, marginBottom: 10, fontWeight: '700' },
  versionActionRow: { flexDirection: 'row', alignItems: 'center' },
  versionDetailButton: { marginLeft: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: local.soft, borderWidth: 1, borderColor: local.line },
  versionDetailText: { color: local.blue, fontWeight: '900' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  typeChip: { borderRadius: 999, backgroundColor: local.soft, borderWidth: 1, borderColor: local.line, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  typeChipActive: { backgroundColor: local.blue, borderColor: local.blue },
  typeText: { color: local.muted, fontSize: 12, fontWeight: '900' },
  typeTextActive: { color: '#FFFFFF' },
  optionsBlock: { marginBottom: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  optionEditorInputWrap: {
    flex: 1,
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 13,
    marginRight: 10,
  },
  optionInput: { flex: 1, marginRight: 0, backgroundColor: 'transparent', paddingHorizontal: 10, borderWidth: 0 },
  optionPreviewBox: { backgroundColor: '#F8F7FF', borderRadius: 12, padding: 12, marginBottom: 12 },
  optionPreviewLabel: { color: local.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 10 },
  previewOptionLine: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  previewOptionText: { color: local.ink, fontSize: 14, fontWeight: '700' },
  previewDateCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F7FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: cardBorder },
  previewDateText: { color: local.ink, fontSize: 14, fontWeight: '700' },
  radioMarker: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#667085', marginRight: 10, backgroundColor: '#FFFFFF' },
  checkboxMarker: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#667085', marginRight: 10, backgroundColor: '#FFFFFF' },
  dropdownIndexMarker: { width: 22, height: 22, borderRadius: 8, backgroundColor: '#ECE9FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dropdownIndexText: { color: local.blue, fontSize: 12, fontWeight: '900' },
  dropdownPreviewControl: { minHeight: 44, maxWidth: 260, borderRadius: 12, borderWidth: 1, borderColor: '#C4B5FD', backgroundColor: '#FDFBFF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownPreviewValue: { color: local.ink, fontWeight: '800' },
  dropdownPreviewArrow: { color: local.muted, fontSize: 22, marginLeft: 18 },
  savedPreview: { marginTop: 8 },
  optionDelete: { borderRadius: 8, backgroundColor: '#F8F7FF', paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1, borderColor: local.line },
  optionDeleteDisabled: { opacity: 0.4 },
  optionDeleteText: { color: local.red, fontWeight: '900', fontSize: 14 },
  optionDeleteTextDisabled: { color: '#9CA3AF' },
  addOptionButton: { borderRadius: 8, backgroundColor: local.soft, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  addOptionText: { color: local.blue, fontWeight: '900', fontSize: 14 },
  recipientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  recipientInput: { flex: 1, marginRight: 10 },
  removeRecipientButton: { borderRadius: 10, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: local.line, paddingHorizontal: 12, paddingVertical: 12 },
  removeRecipientText: { color: local.red, fontWeight: '900' },
  shareLinkText: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: cardBorder,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: local.ink,
    marginBottom: 10,
    ...webInputReset,
  },
  helperText: { color: local.muted, lineHeight: 20, marginBottom: 12 },
  sectionLabel: { color: local.blue, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  versionSummary: { backgroundColor: '#F8F7FF', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: cardBorder, shadowColor: 'rgba(15, 23, 42, 0.06)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 },
  formActionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  cancelButton: { marginLeft: 10, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: local.soft, borderWidth: 1, borderColor: local.line },
  cancelButtonText: { color: local.ink, fontWeight: '900' },
  logicBuilder: { marginBottom: 12 },
  logicRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  logicLabel: { minWidth: 56, color: local.ink, fontWeight: '900' },
  logicSelectWrap: { flex: 1 },
  logicSelectInput: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: cardBorder,
    paddingHorizontal: 12,
    color: local.ink,
    fontWeight: '700',
    ...webInputReset,
  },
  logicInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: cardBorder,
    paddingHorizontal: 12,
    color: local.ink,
    ...webInputReset,
  },
  logicPreviewCard: { borderRadius: 12, backgroundColor: '#F8F7FF', padding: 12, marginBottom: 12, borderWidth: 1, borderColor: cardBorder },
  logicPreviewTitle: { color: local.blue, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 },
  logicPreviewText: { color: local.ink, fontWeight: '700', lineHeight: 20 },
  logicPickerGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  logicPickerColumn: { flex: 1, minWidth: 132, marginRight: 10, marginBottom: 10 },
  logicPickerTitle: { color: local.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 },
  logicChoiceChip: { borderRadius: 10, borderWidth: 1, borderColor: local.line, backgroundColor: local.soft, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  logicChoiceChipActive: { backgroundColor: 'rgba(91, 75, 255, 0.12)', borderColor: local.blue },
  logicChoiceText: { color: local.ink, fontSize: 12, fontWeight: '700' },
  logicChoiceTextActive: { color: local.blue },
  branchBuilderCard: { marginTop: 12, borderTopWidth: 1, borderTopColor: local.line, paddingTop: 12 },
  branchList: { marginTop: 12 },
  branchCard: { backgroundColor: '#F8F7FF', borderRadius: 12, borderWidth: 1, borderColor: cardBorder, padding: 12, marginBottom: 10 },
  branchCardTitle: { color: local.ink, fontWeight: '900', marginBottom: 4 },
  branchCardMeta: { color: local.muted, fontSize: 12, lineHeight: 18, marginBottom: 3 },
  branchSelected: { color: local.blue, fontSize: 12, fontWeight: '800', marginTop: 6 },
  branchLink: { color: local.blue, fontSize: 12, fontWeight: '900', marginTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: '#FBF7FF', borderRadius: 18, padding: 16, maxHeight: '90%', overflow: 'hidden', borderWidth: 1, borderColor: cardBorder, shadowColor: 'rgba(15, 23, 42, 0.10)', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4 },
  scheduleModalCard: { backgroundColor: '#FBF7FF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: cardBorder, shadowColor: 'rgba(15, 23, 42, 0.10)', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 4 },
  scheduleGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, justifyContent: 'space-between' },
  scheduleField: { flex: 1, minWidth: 220, marginRight: 12, marginBottom: 12 },
  scheduleActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10 },
  scheduleSecondaryButton: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: local.line, backgroundColor: '#F7F1FF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginRight: 10 },
  scheduleSecondaryText: { color: local.ink, fontWeight: '700' },
  modalScroll: { maxHeight: '100%' },
  modalScrollContent: { paddingBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { color: local.ink, fontSize: 20, fontWeight: '900' },
  modalClose: { color: local.blue, fontWeight: '800' },
  modalLabel: { color: local.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 },
  modalQuestionTitle: { color: local.ink, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  modalOptionList: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  modalOptionChip: { borderRadius: 999, borderWidth: 1, borderColor: local.line, backgroundColor: local.soft, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  modalOptionChipActive: { backgroundColor: 'rgba(91, 75, 255, 0.12)', borderColor: local.blue },
  modalOptionText: { color: local.ink, fontSize: 12, fontWeight: '800' },
  modalOptionTextActive: { color: local.blue },
  modalSelectedCard: { backgroundColor: '#F8F7FF', borderRadius: 12, borderWidth: 1, borderColor: cardBorder, padding: 12, marginBottom: 12 },
  modalSelectedLabel: { color: local.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  modalSelectedValue: { color: local.ink, fontSize: 16, fontWeight: '800' },
  modalChildrenBlock: { marginTop: 8, marginBottom: 12 },
  modalChildrenTitle: { color: local.ink, fontSize: 14, fontWeight: '900', marginBottom: 8 },
  modalChildRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: local.line },
  modalChildIndex: { color: local.blue, fontWeight: '900', marginRight: 8 },
  modalChildTitle: { color: local.ink, fontWeight: '700', flex: 1 },
  modalBuilderCard: { marginTop: 10, borderTopWidth: 1, borderTopColor: local.line, paddingTop: 12 },
  listBlock: { marginTop: 14 },
  questionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: local.line },
  responseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: local.line },
  responseDetailCard: { borderTopWidth: 1, borderTopColor: local.line, paddingVertical: 14 },
  responseDetailTop: { flexDirection: 'row', alignItems: 'center' },
  ruleRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: local.line },
  ruleDeleteButton: { alignSelf: 'flex-start', marginTop: 8 },
  indexBadge: { width: 34, height: 34, borderRadius: 8, backgroundColor: local.soft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  indexText: { color: local.blue, fontWeight: '900' },
  rowCopy: { flex: 1, marginRight: 8 },
  rowTitle: { color: local.ink, fontWeight: '900' },
  rowMeta: { color: local.muted, fontSize: 12, marginTop: 3 },
  rowMetaTags: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  questionActionButton: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: local.soft, borderWidth: 1, borderColor: local.line, marginRight: 8, marginBottom: 8 },
  questionActionText: { color: local.ink, fontWeight: '700', fontSize: 12 },
  questionActionDanger: { backgroundColor: '#FCE7E7', borderColor: 'rgba(239, 68, 68, 0.2)' },
  questionActionDangerText: { color: local.red },
  questionActionSelected: { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: local.blue },
  ruleBadge: { color: local.muted, fontSize: 11, fontWeight: '700' },
  followupExpansion: { marginTop: 10, borderRadius: 10, backgroundColor: '#F8F7FF', borderWidth: 1, borderColor: cardBorder, padding: 10 },
  followupGroupCard: { marginBottom: 8 },
  followupGroupHeader: { color: local.blue, fontSize: 12, fontWeight: '900', marginBottom: 4 },
  followupGroupItem: { color: local.ink, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  deleteMini: { borderRadius: 8, backgroundColor: local.soft, paddingHorizontal: 10, paddingVertical: 8 },
  deleteMiniText: { color: local.red, fontSize: 12, fontWeight: '900' },
  responseAvatar: { width: 38, height: 38, borderRadius: 8, backgroundColor: local.soft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  responseAvatarText: { color: local.blue, fontWeight: '900' },
  answerTable: { marginTop: 12, backgroundColor: '#F8F7FF', borderRadius: 8, borderWidth: 1, borderColor: cardBorder, overflow: 'hidden' },
  answerRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: local.line },
  answerQuestion: { color: local.muted, fontSize: 12, fontWeight: '900', marginBottom: 4 },
  answerValue: { color: local.ink, fontSize: 14, lineHeight: 20 },
  analyticsCard: { backgroundColor: '#F8F7FF', borderRadius: 8, borderWidth: 1, borderColor: cardBorder, padding: 14, marginBottom: 12 },
  analyticsHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  analyticsOptionRow: { marginBottom: 12 },
  analyticsOptionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  analyticsOptionLabel: { flex: 1, color: local.ink, fontWeight: '900', marginRight: 10 },
  analyticsOptionValue: { color: local.blue, fontSize: 12, fontWeight: '900' },
  analyticsTrack: { height: 10, borderRadius: 999, backgroundColor: '#ECE9FF', overflow: 'hidden' },
  analyticsFill: { height: 10, borderRadius: 999, backgroundColor: local.blue },
  ratingBadge: { backgroundColor: '#ECE9FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  ratingBadgeText: { color: local.blue, fontWeight: '900', fontSize: 12 },
  answerPreviewList: { backgroundColor: '#FBF7FF', borderRadius: 8, borderWidth: 1, borderColor: cardBorder, padding: 12 },
  answerPreviewText: { color: local.ink, lineHeight: 20, marginBottom: 8 },
  typeChipContent: { flexDirection: 'row', alignItems: 'center' },
  typeIcon: { marginRight: 6 },
  fullColumn: { width: '100%', maxWidth: 980, alignSelf: 'center' },
  searchRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12, flexWrap: 'wrap', width: '100%', maxWidth: 860 },
  searchInput: {
    flex: 1,
    minWidth: 220,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    color: local.ink,
    marginRight: 8,
    borderWidth: 1,
    borderColor: cardBorder,
    maxWidth: 560,
    ...webInputReset,
  },
  searchButton: { width: 82, borderRadius: 14, backgroundColor: local.ink, alignItems: 'center', justifyContent: 'center' },
  searchText: { color: '#FFFFFF', fontWeight: '900' },
  resultMeta: { color: local.muted, fontSize: 12, fontWeight: '800', marginBottom: 10 },
  emptyState: { backgroundColor: local.soft, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: cardBorder },
  emptyText: { color: local.muted, lineHeight: 20 },
  dangerPanel: { backgroundColor: '#FFF0F3', borderRadius: 8, borderWidth: 1, borderColor: '#F4C7D0', padding: 16, flexDirection: 'row', alignItems: 'center' },
  dangerCopy: { flex: 1, marginRight: 12 },
  dangerTitle: { color: local.red, fontWeight: '900', fontSize: 16 },
  dangerText: { color: local.red, fontSize: 14, marginTop: 3 },
});
