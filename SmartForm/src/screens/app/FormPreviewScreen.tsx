import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { AppStackParamList } from '../../navigation/NavigationTypes';
import { conditionalRulesService, ConditionalRuleItem } from '../../api/conditional-rules-service';
import { formsService, FormItem } from '../../api/forms-service';
import { questionsService, QuestionItem } from '../../api/questions-service';
import { getErrorMessage } from '../../api/client';
import { evaluateConditionalOperator } from '../../utils';
import { webInputReset } from '../../utils/webInputReset';

type PublicOption = {
  id?: string;
  option_text: string;
  order_index?: number;
};

type PreviewQuestion = QuestionItem & {
  options?: PublicOption[];
};

const palette = {
  page: '#F0E8FF',
  surface: '#FBF7FF',
  surfaceSoft: '#F4EEFF',
  ink: '#171429',
  muted: '#716C87',
  line: '#E3D8FF',
  primary: '#7657F7',
  primarySoft: '#ECE9FF',
  danger: '#D9576B',
  success: '#159A8A',
};

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const FormPreviewScreen: React.FC<NativeStackScreenProps<AppStackParamList, 'FormPreview'>> = ({ route, navigation }) => {
  const { formId } = route.params;
  const [form, setForm] = useState<FormItem | null>(null);
  const [questions, setQuestions] = useState<PreviewQuestion[]>([]);
  const [rules, setRules] = useState<ConditionalRuleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checkboxAnswers, setCheckboxAnswers] = useState<Record<string, string[]>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [respondentEmail, setRespondentEmail] = useState('');
  const [fileUploads, setFileUploads] = useState<Record<string, File | null>>({});
  const [activeStep, setActiveStep] = useState(0);

  const loadData = async () => {
    try {
      setError(null);
      const [formData, questionData, ruleData] = await Promise.all([
        formsService.get(formId),
        questionsService.listByForm(formId),
        conditionalRulesService.listByForm(formId),
      ]);
      setForm(formData);
      setQuestions((questionData as PreviewQuestion[]).slice().sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0)));
      setRules(ruleData.items);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [formId]);

  const branches = useMemo(() => (form?.branches ?? []).slice(), [form]);
  const branchesByTrigger = useMemo(() => {
    const map = new Map<string, typeof branches>();
    branches.forEach((branch) => {
      const list = map.get(branch.trigger_question_id) ?? [];
      list.push(branch);
      map.set(branch.trigger_question_id, list);
    });
    return map;
  }, [branches]);
  const branchById = useMemo(() => new Map(branches.map((branch) => [branch.id, branch] as const)), [branches]);

  const getAnswerValue = (questionId: string) => (checkboxAnswers[questionId]?.join(', ') ?? answers[questionId] ?? '').trim();

  const branchVisibleIds = useMemo(() => {
    const visible = new Set<string>();
    const rootQuestions = questions.filter((question) => !question.branch_id);

    const visitBranch = (branchId: string | null) => {
      const branchQuestions = questions
        .filter((question) => (question.branch_id ?? null) === branchId)
        .sort((left, right) => Number(left.order_index || 0) - Number(right.order_index || 0));

      for (const question of branchQuestions) {
        visible.add(question.id);
        const answerValue = getAnswerValue(question.id).toLowerCase();
        for (const branch of branchesByTrigger.get(question.id) ?? []) {
          if (branch.trigger_option_text.trim().toLowerCase() !== answerValue) continue;
          visitBranch(branch.id);
        }
      }
    };

    rootQuestions.forEach((question) => {
      visible.add(question.id);
      const answerValue = getAnswerValue(question.id).toLowerCase();
      for (const branch of branchesByTrigger.get(question.id) ?? []) {
        if (branch.trigger_option_text.trim().toLowerCase() !== answerValue) continue;
        visitBranch(branch.id);
      }
    });

    return visible;
  }, [answers, branchesByTrigger, checkboxAnswers, questions]);

  const activeBranchChain = useMemo(() => {
    const chain: string[] = [];
    let currentBranchId: string | null = null;
    const visited = new Set<string>();

    while (true) {
      const sectionQuestions = questions
        .filter((question) => (question.branch_id ?? null) === currentBranchId)
        .sort((left, right) => Number(left.order_index || 0) - Number(right.order_index || 0));

      let nextBranchId: string | null = null;
      for (const question of sectionQuestions) {
        const answerValue = getAnswerValue(question.id).toLowerCase();
        const nextBranch = (branchesByTrigger.get(question.id) ?? []).find(
          (branch) => branch.trigger_option_text.trim().toLowerCase() === answerValue,
        );
        if (nextBranch) {
          nextBranchId = nextBranch.id;
          break;
        }
      }

      if (!nextBranchId || visited.has(nextBranchId)) {
        break;
      }

      chain.push(nextBranchId);
      visited.add(nextBranchId);
      currentBranchId = nextBranchId;
    }

    return chain;
  }, [answers, branchesByTrigger, checkboxAnswers, questions]);

  const activeSections = useMemo(() => {
    const rootSection = {
      branchId: null as string | null,
      title: form?.title ?? 'Form',
      description: form?.description ?? null,
      isRoot: true,
    };

    return [
      rootSection,
      ...activeBranchChain.map((branchId) => ({
        branchId,
        title: branchById.get(branchId)?.title ?? 'Follow-up form',
        description: branchById.get(branchId)?.description ?? null,
        isRoot: false,
      })),
    ];
  }, [activeBranchChain, branchById, form?.description, form?.title]);

  useEffect(() => {
    setActiveStep((current) => Math.min(current, Math.max(0, activeSections.length - 1)));
  }, [activeSections.length]);

  const visibleQuestionIds = useMemo(() => {
    const rootIds = new Set(questions.filter((question) => !question.branch_id).map((question) => question.id));
    const visibleIds = new Set<string>([...rootIds, ...branchVisibleIds]);
    const requiredIds = new Set(
      questions.filter((question) => question.required && visibleIds.has(question.id)).map((question) => question.id),
    );

    rules.forEach((rule) => {
      const triggerValue = getAnswerValue(rule.trigger_field_id);
      const matches = evaluateConditionalOperator(triggerValue, rule.trigger_operator, rule.trigger_value);
      if (!matches) return;

      if (rule.target_action === 'hide') {
        visibleIds.delete(rule.target_field_id);
        requiredIds.delete(rule.target_field_id);
      }
      if (rule.target_action === 'show') {
        visibleIds.add(rule.target_field_id);
      }
      if (rule.target_action === 'require') {
        visibleIds.add(rule.target_field_id);
        requiredIds.add(rule.target_field_id);
      }
      if (rule.target_action === 'unrequire') {
        requiredIds.delete(rule.target_field_id);
      }
    });

    return { visibleIds, requiredIds };
  }, [branchVisibleIds, questions, rules]);

  const currentSection = activeSections[activeStep] ?? activeSections[0];
  const currentSectionQuestions = useMemo(
    () =>
      questions
        .filter((question) => (question.branch_id ?? null) === (currentSection?.branchId ?? null))
        .sort((left, right) => Number(left.order_index || 0) - Number(right.order_index || 0))
        .filter((question) => visibleQuestionIds.visibleIds.has(question.id)),
    [currentSection?.branchId, questions, visibleQuestionIds.visibleIds],
  );
  const hasNextStep = activeStep < activeSections.length - 1;

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setFieldErrors((current) => ({ ...current, [questionId]: '' }));
    setPreviewError(null);
  };

  const triggerWebFilePicker = (questionId: string) => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files && target.files[0] ? target.files[0] : null;
      setFileUploads((current) => ({ ...current, [questionId]: file }));
      setFieldErrors((current) => ({ ...current, [questionId]: '' }));
      setPreviewError(null);
    };
    input.click();
  };

  const toggleCheckboxAnswer = (questionId: string, optionText: string) => {
    setCheckboxAnswers((current) => {
      const existing = current[questionId] || [];
      const next = existing.includes(optionText)
        ? existing.filter((item) => item !== optionText)
        : [...existing, optionText];
      return { ...current, [questionId]: next };
    });
    setFieldErrors((current) => ({ ...current, [questionId]: '' }));
    setPreviewError(null);
  };

  const validateQuestions = (items: PreviewQuestion[]) => {
    const nextErrors: Record<string, string> = {};
    if (form?.collect_email && respondentEmail.trim() && !emailPattern.test(respondentEmail.trim())) {
      nextErrors.__email = 'Enter a valid email address.';
    }

    items.forEach((question) => {
      const value = (answers[question.id] || '').trim();
      const selections = checkboxAnswers[question.id] || [];
      const fileValue = fileUploads[question.id];
      if (!question.required) return;
      if (question.question_type === 'checkbox' && selections.length === 0) {
        nextErrors[question.id] = 'This question is required.';
      } else if (question.question_type === 'file_upload' && !fileValue) {
        nextErrors[question.id] = 'Please upload a file.';
      } else if (question.question_type === 'date' && value && Number.isNaN(Date.parse(value))) {
        nextErrors[question.id] = 'Choose a valid date.';
      } else if (question.question_type !== 'checkbox' && !value) {
        nextErrors[question.id] = 'This question is required.';
      }
    });

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateQuestions(currentSectionQuestions)) {
      setPreviewError('Please fix the highlighted questions before continuing.');
      return;
    }
    setPreviewError(null);
    setActiveStep((current) => Math.min(current + 1, activeSections.length - 1));
  };

  const goBack = () => {
    setPreviewError(null);
    setActiveStep((current) => Math.max(0, current - 1));
  };

  const renderChoiceChips = (question: PreviewQuestion, options: string[], isMulti = false) => {
    const currentValue = getAnswerValue(question.id).toLowerCase();
    const selected = checkboxAnswers[question.id] ?? [];

    return (
      <View style={styles.choiceWrap}>
        {options.map((option) => {
          const isActive = isMulti ? selected.includes(option) : currentValue === option.toLowerCase();
          return (
            <TouchableOpacity
              key={option}
              style={[styles.choiceChip, isActive ? styles.choiceChipActive : null]}
              activeOpacity={0.85}
              onPress={() => {
                if (isMulti) {
                  toggleCheckboxAnswer(question.id, option);
                } else {
                  updateAnswer(question.id, option);
                }
              }}
            >
              <Text style={[styles.choiceText, isActive ? styles.choiceTextActive : null]}>{option}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderQuestion = (question: PreviewQuestion) => {
    const options = (question.options ?? []).map((option) => option.option_text).filter(Boolean);
    const error = fieldErrors[question.id];
    const isRequired = visibleQuestionIds.requiredIds.has(question.id);
    const label = `${question.title}${isRequired ? ' *' : ''}`;
    const value = answers[question.id] ?? '';

    return (
      <View key={question.id} style={[styles.questionCard, error ? styles.questionCardError : null]}>
        <Text style={styles.questionLabel}>{label}</Text>
        {question.placeholder ? <Text style={styles.questionHint}>{question.placeholder}</Text> : null}

        {question.question_type === 'paragraph' ? (
          <TextInput
            value={answers[question.id] ?? ''}
            onChangeText={(text) => updateAnswer(question.id, text)}
            placeholder={question.placeholder || 'Enter your answer'}
            placeholderTextColor="#5EA0FF"
            multiline
            style={[styles.underlineInput, styles.textArea]}
          />
        ) : question.question_type === 'checkbox' ? (
          renderChoiceChips(question, options, true)
        ) : ['radio', 'dropdown', 'yes_no'].includes(question.question_type) ? (
          renderChoiceChips(question, options.length > 0 ? options : ['Yes', 'No'])
      ) : question.question_type === 'rating' ? (
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => {
            const active = Number(answers[question.id]) === value;
            return (
                <TouchableOpacity
                  key={value}
                  style={[styles.ratingPill, active ? styles.ratingPillActive : null]}
                  onPress={() => updateAnswer(question.id, String(value))}
                >
                  <Text style={[styles.ratingText, active ? styles.ratingTextActive : null]}>{value}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : question.question_type === 'date' ? (
        Platform.OS === 'web' ? (
          React.createElement('input', {
            type: 'date',
            value,
            onChange: (event: any) => updateAnswer(question.id, String(event?.target?.value ?? '')),
            style: styles.dateInputWeb,
          })
        ) : (
          <TextInput
            value={value}
            onChangeText={(text) => updateAnswer(question.id, text)}
            placeholder={question.placeholder || 'YYYY-MM-DD'}
            placeholderTextColor="#5EA0FF"
            keyboardType="numbers-and-punctuation"
            style={styles.underlineInput}
          />
        )
      ) : question.question_type === 'file_upload' ? (
        <View style={styles.filePreviewCard}>
          {Platform.OS === 'web' ? (
            <>
              <TouchableOpacity onPress={() => triggerWebFilePicker(question.id)} style={styles.filePickerButton}>
                <Text style={styles.filePickerText}>{fileUploads[question.id] ? 'Change file' : 'Choose file'}</Text>
              </TouchableOpacity>
              <Text style={styles.filePreviewText}>
                {fileUploads[question.id] ? String(fileUploads[question.id]?.name) : 'No file selected'}
              </Text>
            </>
          ) : (
            <>
              <Feather name="upload-cloud" size={18} color={palette.primary} />
              <Text style={styles.filePreviewText}>File upload preview</Text>
            </>
          )}
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={(text) => updateAnswer(question.id, text)}
            placeholder={question.placeholder || 'Enter your answer'}
            placeholderTextColor="#5EA0FF"
            keyboardType={question.question_type === 'email' ? 'email-address' : question.question_type === 'number' ? 'numeric' : 'default'}
            autoCapitalize={question.question_type === 'email' ? 'none' : 'sentences'}
            style={styles.underlineInput}
          />
        )}

        {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (error || !form) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Preview unavailable.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.backgroundLayer} pointerEvents="none">
        <View style={styles.bgGlowOne} />
        <View style={styles.bgGlowTwo} />
        <View style={styles.bgGlowThree} />
      </View>
      <View style={styles.shell}>
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Form review</Text>
              <Text style={styles.title}>{form.title}</Text>
              <Text style={styles.subtitle}>{form.description || 'This is how the form will feel to respondents.'}</Text>
            </View>
            <View style={styles.previewPill}>
              <Feather name="eye" size={14} color={palette.primary} />
              <Text style={styles.previewPillText}>Preview mode</Text>
            </View>
          </View>
          <View style={styles.headerDivider} />
          <Text style={styles.requiredNote}>Review the same structure and spacing used by the public form.</Text>
        </View>

        {previewError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{previewError}</Text>
          </View>
        ) : null}

        {form.collect_email ? (
          <View style={[styles.questionCard, fieldErrors.__email ? styles.questionCardError : null]}>
            <Text style={styles.questionLabel}>
              Email <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              value={respondentEmail}
              onChangeText={(text) => {
                setRespondentEmail(text);
                setPreviewError(null);
              }}
              placeholder="name@example.com"
              placeholderTextColor="#5EA0FF"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.underlineInput}
            />
            {fieldErrors.__email ? <Text style={styles.fieldError}>{fieldErrors.__email}</Text> : null}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.sectionTopRow}>
            <View style={styles.sectionCopy}>
              <Text style={styles.sectionEyebrow}>{currentSection?.isRoot ? 'Main form' : 'Follow-up form'}</Text>
              <Text style={styles.sectionTitle}>{currentSection?.title ?? form.title}</Text>
              {currentSection?.description ? <Text style={styles.sectionDescription}>{currentSection.description}</Text> : null}
            </View>
            <View style={styles.sectionStepPill}>
              <Text style={styles.sectionStepPillText}>{activeStep + 1}/{activeSections.length}</Text>
            </View>
          </View>
          {!currentSection?.isRoot ? <Text style={styles.branchHint}>This section appears because of a previous answer.</Text> : null}
        </View>

        {currentSectionQuestions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No questions are visible for this section yet.</Text>
          </View>
        ) : currentSectionQuestions.map(renderQuestion)}

        <View style={styles.footer}>
          <TouchableOpacity style={[styles.secondaryButton, activeStep === 0 ? styles.secondaryButtonMuted : null]} onPress={goBack} disabled={activeStep === 0}>
            <Feather name="arrow-left" size={16} color={activeStep === 0 ? palette.muted : palette.primary} />
            <Text style={[styles.secondaryButtonText, activeStep === 0 ? styles.secondaryButtonTextMuted : null]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={hasNextStep ? goNext : () => navigation.goBack()}>
            <Text style={styles.primaryButtonText}>{hasNextStep ? 'Next' : 'Close preview'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F5FF' },
  content: { padding: 16, paddingBottom: 28, alignItems: 'center', position: 'relative', overflow: 'hidden' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.page },
  backgroundLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgGlowOne: { position: 'absolute', top: -70, left: -90, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(91, 75, 255, 0.16)' },
  bgGlowTwo: { position: 'absolute', top: 140, right: -110, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(46, 166, 255, 0.14)' },
  bgGlowThree: { position: 'absolute', bottom: -120, left: '16%', width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(168, 111, 255, 0.10)' },
  shell: { width: '100%', maxWidth: 860 },
  headerCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 8, borderWidth: 1, borderColor: palette.line, marginBottom: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { color: palette.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  title: { color: palette.ink, fontSize: 32, fontWeight: '800', lineHeight: 39, marginBottom: 12 },
  subtitle: { color: palette.ink, fontSize: 16, lineHeight: 23, marginBottom: 14 },
  previewPill: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F3F0FF', borderWidth: 1, borderColor: palette.line },
  previewPillText: { color: palette.primary, fontWeight: '800', marginLeft: 6 },
  headerDivider: { height: 1, backgroundColor: palette.line, marginVertical: 10 },
  requiredNote: { color: palette.danger, fontSize: 14 },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, borderWidth: 1, borderColor: palette.line, marginBottom: 12 },
  sectionTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  sectionCopy: { flex: 1, paddingRight: 8 },
  sectionEyebrow: { color: palette.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionTitle: { color: palette.ink, fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 4 },
  sectionDescription: { color: palette.muted, marginTop: 8, lineHeight: 20 },
  sectionStepPill: { backgroundColor: '#F3F0FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  sectionStepPillText: { color: palette.primary, fontSize: 12, fontWeight: '900' },
  branchHint: { color: palette.primary, marginTop: 10, fontSize: 13, fontWeight: '700' },
  questionCard: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 24, marginBottom: 12, borderWidth: 1, borderColor: palette.line },
  questionCardError: { borderColor: palette.danger, borderLeftWidth: 6 },
  questionLabel: { color: palette.ink, fontSize: 16, lineHeight: 24, marginBottom: 18 },
  asterisk: { color: palette.danger },
  underlineInput: {
    minHeight: 44,
    maxWidth: 360,
    paddingVertical: 8,
    color: palette.ink,
    fontSize: 16,
    borderWidth: 0,
    ...webInputReset,
  },
  textArea: { minHeight: 96, maxWidth: 560, textAlignVertical: 'top' },
  questionHint: { color: palette.muted, marginBottom: 12, lineHeight: 20 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: -8 },
  choiceChip: { borderRadius: 999, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surfaceSoft, paddingHorizontal: 13, paddingVertical: 9, marginRight: 8, marginBottom: 8 },
  choiceChipActive: { backgroundColor: 'rgba(118, 87, 247, 0.12)', borderColor: palette.primary },
  choiceText: { color: palette.ink, fontWeight: '700' },
  choiceTextActive: { color: palette.primary },
  dateInputWeb: {
    width: '100%',
    maxWidth: 240,
    minHeight: 46,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    color: palette.ink,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    ...webInputReset,
  },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap' },
  ratingPill: { width: 42, height: 42, borderRadius: 14, marginRight: 10, marginBottom: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  ratingPillActive: { backgroundColor: 'rgba(118, 87, 247, 0.12)', borderColor: palette.primary },
  ratingText: { color: palette.ink, fontWeight: '800' },
  ratingTextActive: { color: palette.primary },
  filePreviewCard: { minHeight: 72, borderRadius: 16, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surfaceSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  filePickerButton: { minHeight: 42, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: palette.line, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  filePickerText: { color: palette.primary, fontWeight: '800' },
  filePreviewText: { color: palette.ink, marginLeft: 8, fontWeight: '700' },
  fieldError: { color: palette.danger, fontWeight: '700', marginTop: 10 },
  errorBox: { backgroundColor: 'rgba(217, 87, 107, 0.1)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(217, 87, 107, 0.2)', padding: 12, marginBottom: 12 },
  errorText: { color: palette.danger, fontWeight: '700' },
  emptyCard: { backgroundColor: palette.surface, borderRadius: 20, borderWidth: 1, borderColor: palette.line, padding: 18, marginBottom: 12 },
  emptyText: { color: palette.muted, lineHeight: 20 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 18, gap: 10, flexWrap: 'wrap' },
  secondaryButton: { minWidth: 92, minHeight: 42, borderRadius: 4, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: palette.line },
  secondaryButtonMuted: { opacity: 0.55 },
  secondaryButtonText: { marginLeft: 8, color: palette.ink, fontWeight: '700' },
  secondaryButtonTextMuted: { color: palette.muted },
  primaryButton: { minWidth: 104, minHeight: 42, borderRadius: 4, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, flex: 1, marginLeft: 12 },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
});
