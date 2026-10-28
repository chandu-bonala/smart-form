import React, { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/NavigationTypes';
import { publicFormsService } from '../../api/public-forms-service';
import { FormItem } from '../../api/forms-service';
import { ENDPOINTS } from '../../constants/api';
import { httpClient } from '../../api/client';
import {
  evaluateConditionalOperator,
  type ConditionalRuleAction,
  type ConditionalRuleOperator,
} from '../../utils';
import { webInputReset } from '../../utils/webInputReset';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicForm'>;

type PublicOption = {
  id?: string;
  option_text: string;
  order_index?: number;
};

type PublicQuestion = {
  id: string;
  title: string;
  question_type: string;
  branch_id?: string | null;
  placeholder?: string | null;
  required?: boolean;
  order_index?: number;
  options?: PublicOption[];
};

type PublicBranch = {
  id: string;
  form_id: string;
  trigger_question_id: string;
  trigger_option_text: string;
  title: string;
  description?: string | null;
  order_index?: number;
};

type PublicRule = {
  id?: string;
  trigger_field_id: string;
  trigger_operator: ConditionalRuleOperator;
  trigger_value?: string | null;
  target_field_id: string;
  target_action: ConditionalRuleAction;
};

const local = {
  purple: '#7657F7',
  purpleDark: '#31226F',
  ink: '#171429',
  muted: '#716C87',
  line: '#DED9FB',
  softLine: '#F1F0FF',
  page: '#F6F5FF',
  danger: '#D9576B',
  success: '#159A8A',
};

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const PublicFormScreen: React.FC<Props> = ({ route }) => {
  const slug = route.params?.slug;
  const startedAt = useRef(Date.now());
  const [form, setForm] = useState<FormItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checkboxAnswers, setCheckboxAnswers] = useState<Record<string, string[]>>({});
  const [respondentEmail, setRespondentEmail] = useState('');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [fileUploads, setFileUploads] = useState<Record<string, File | null>>({});
  const [activeStep, setActiveStep] = useState(0);
  const [focusedFieldId, setFocusedFieldId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!slug) {
        setError('Invalid public form link.');
        setLoading(false);
        return;
      }

      try {
        setError(null);
        setLoading(true);
        const formData = await publicFormsService.get(slug);
        setForm(formData);
      } catch {
        setError('Unable to load this form. It may be private, unpublished, or removed.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  const questions = useMemo(
    () =>
      ((form?.questions || []) as PublicQuestion[])
        .slice()
        .sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0)),
    [form],
  );
  const branches = useMemo(() => ((form?.branches || []) as PublicBranch[]).slice(), [form]);

  const rules = useMemo(() => ((form?.conditional_rules || []) as PublicRule[]).slice(), [form]);
  const branchesByTrigger = useMemo(() => {
    const map = new Map<string, PublicBranch[]>();
    branches.forEach((branch) => {
      const list = map.get(branch.trigger_question_id) ?? [];
      list.push(branch);
      map.set(branch.trigger_question_id, list);
    });
    return map;
  }, [branches]);
  const branchById = useMemo(() => new Map(branches.map((branch) => [branch.id, branch] as const)), [branches]);

  const getAnswerValue = (questionId: string) => {
    if (checkboxAnswers[questionId]) {
      return checkboxAnswers[questionId].join(', ');
    }
    return (answers[questionId] ?? '').toString();
  };

  const branchVisibleIds = useMemo(() => {
    const visible = new Set<string>();
    const rootQuestions = questions.filter((question) => !question.branch_id);

    const visitBranch = (branchId: string | null) => {
      const branchQuestions = questions
        .filter((question) => (question.branch_id ?? null) === branchId)
        .sort((left, right) => Number(left.order_index || 0) - Number(right.order_index || 0));

      for (const question of branchQuestions) {
        visible.add(question.id);
        const branchOptions = branchesByTrigger.get(question.id) ?? [];
        const answerValue = getAnswerValue(question.id).trim().toLowerCase();
        for (const branch of branchOptions) {
          if (branch.trigger_option_text.trim().toLowerCase() !== answerValue) continue;
          visitBranch(branch.id);
        }
      }
    };

    rootQuestions.forEach((question) => {
      visible.add(question.id);
      const branchOptions = branchesByTrigger.get(question.id) ?? [];
      const answerValue = getAnswerValue(question.id).trim().toLowerCase();
      for (const branch of branchOptions) {
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
        const answerValue = getAnswerValue(question.id).trim().toLowerCase();
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
    const conditionalShowTargets = new Set(
      rules.filter((rule) => rule.target_action === 'show').map((rule) => rule.target_field_id),
    );
    const visibleIds = new Set<string>([...rootIds, ...branchVisibleIds]);
    conditionalShowTargets.forEach((questionId) => visibleIds.delete(questionId));

    const requiredIds = new Set(
      questions.filter((question) => question.required && branchVisibleIds.has(question.id)).map((question) => question.id),
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

  const visibleQuestions = useMemo(() => {
    const renderBranch = (branchId: string | null): PublicQuestion[] => {
      const branchQuestions = questions
        .filter((question) => (question.branch_id ?? null) === branchId)
        .sort((left, right) => Number(left.order_index || 0) - Number(right.order_index || 0));

      const output: PublicQuestion[] = [];
      branchQuestions.forEach((question) => {
        if (!visibleQuestionIds.visibleIds.has(question.id)) return;
        output.push(question);

        const branchOptions = branches.filter((branch) => branch.trigger_question_id === question.id);
        const answerValue = getAnswerValue(question.id).trim().toLowerCase();
        branchOptions.forEach((branch) => {
          if (branch.trigger_option_text.trim().toLowerCase() !== answerValue) return;
          output.push(...renderBranch(branch.id));
        });
      });
      return output;
    };

    return renderBranch(null);
  }, [branches, questions, visibleQuestionIds.visibleIds, answers, checkboxAnswers]);

  const requiredQuestionIds = visibleQuestionIds.requiredIds;
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
  };

  const resetForAnotherResponse = () => {
    setSubmitted(false);
    setAnswers({});
    setCheckboxAnswers({});
    setFieldErrors({});
    setError(null);
    setFileUploads({});
    setOpenDropdownId(null);
    setActiveStep(0);
    startedAt.current = Date.now();
  };

  const triggerWebFilePicker = (questionId: string) => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files && target.files[0] ? target.files[0] : null;
      setFileUploads((current) => ({ ...current, [questionId]: file }));
    };
    input.click();
  };

  const validateQuestions = (questionsToCheck: PublicQuestion[]) => {
    if (!form) return false;

    const nextErrors: Record<string, string> = {};
    if (form.collect_email && !emailPattern.test(respondentEmail.trim())) {
      nextErrors.__email = 'Enter a valid email address.';
    }

    questionsToCheck.forEach((question) => {
      const type = question.question_type;
      const textValue = (answers[question.id] || '').trim();
      const checks = checkboxAnswers[question.id] || [];
      const fileValue = fileUploads[question.id];
      const isRequired = requiredQuestionIds.has(question.id);

      if (isRequired && type === 'file_upload' && !fileValue) {
        nextErrors[question.id] = 'Please upload a file.';
      } else if (isRequired && type === 'checkbox' && checks.length === 0) {
        nextErrors[question.id] = 'This is a required question.';
      } else if (type === 'date' && textValue && Number.isNaN(Date.parse(textValue))) {
        nextErrors[question.id] = 'Choose a valid date.';
      } else if (isRequired && type !== 'checkbox' && !textValue) {
        nextErrors[question.id] = 'This is a required question.';
      } else if (type === 'email' && textValue && !emailPattern.test(textValue)) {
        nextErrors[question.id] = 'Enter a valid email address.';
      } else if (type === 'number' && textValue && Number.isNaN(Number(textValue))) {
        nextErrors[question.id] = 'Enter a valid number.';
      }
    });

    setFieldErrors(nextErrors);
    return Object.values(nextErrors).filter(Boolean).length === 0;
  };

  const goBackStep = () => {
    setActiveStep((current) => Math.max(0, current - 1));
  };

  const goNextStep = () => {
    if (!validateQuestions(currentSectionQuestions)) {
      setError('Please fix the highlighted questions before continuing.');
      return;
    }
    setError(null);
    setActiveStep((current) => Math.min(current + 1, activeSections.length - 1));
  };

  const handleSubmit = async () => {
    if (!form || !slug || !validateQuestions(visibleQuestions)) {
      setError('Please fix the highlighted questions before submitting.');
      return;
    }

    const { device, browser } = getClientHints();
    const completionTime = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
    const payload = {
      form_id: form.id,
      respondent_email: form.collect_email ? respondentEmail.trim() : null,
      completion_time: completionTime,
      device,
      browser,
      answers: visibleQuestions.map((question) => {
        const value =
          question.question_type === 'checkbox'
            ? JSON.stringify(checkboxAnswers[question.id] || [])
            : (answers[question.id] || '').trim();

        return {
          question_id: question.id,
          answer: value || null,
        };
      }),
    };

    try {
      setError(null);
      setSaving(true);
      const responseData = await publicFormsService.submit(slug, payload);

      if (Platform.OS === 'web' && Object.keys(fileUploads).length > 0) {
        const responseAnswers = responseData?.answers || [];
        for (const [questionId, fileObj] of Object.entries(fileUploads)) {
          if (!fileObj) continue;
          const answer = responseAnswers.find((item: { question_id: string }) => item.question_id === questionId);
          if (!answer) continue;

          const formData = new FormData();
          formData.append('answer_id', answer.id);
          formData.append('file', fileObj);

          try {
            await httpClient.post(ENDPOINTS.UPLOAD.CREATE, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            });
          } catch (uploadErr) {
            console.error('Upload failed for', questionId, uploadErr);
          }
        }
      }

      setSubmitted(true);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to submit response. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={local.purple} />
      </View>
    );
  }

  if (!form) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Form not found.'}</Text>
      </View>
    );
  }

  if (submitted) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.backgroundLayer} pointerEvents="none">
          <View style={styles.bgGlowOne} />
          <View style={styles.bgGlowTwo} />
          <View style={styles.bgGlowThree} />
        </View>
        <View style={styles.formShell}>
          <View style={styles.thankYouCard}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.title}>{form.title}</Text>
            <Text style={styles.thankYouText}>Your response has been recorded.</Text>
            {form.allow_multiple_responses ? (
              <TouchableOpacity style={styles.submitAnother} onPress={resetForAnotherResponse}>
                <Text style={styles.submitAnotherText}>Submit another response</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.backgroundLayer} pointerEvents="none">
        <View style={styles.bgGlowOne} />
        <View style={styles.bgGlowTwo} />
        <View style={styles.bgGlowThree} />
      </View>
      <View style={styles.formShell}>
        <View style={styles.header}>
          <Text style={styles.title}>{form.title}</Text>
          {form.description ? <Text style={styles.description}>{form.description}</Text> : null}
          <View style={styles.headerDivider} />
          <Text style={styles.requiredNote}>* Indicates required question</Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionCardTop}>
            <View style={styles.sectionCardCopy}>
              <Text style={styles.sectionEyebrow}>
                {currentSection?.isRoot ? 'Main form' : 'Follow-up form'}
              </Text>
              <Text style={styles.sectionTitle}>
                {currentSection?.title ?? form.title}
              </Text>
              {currentSection?.description ? <Text style={styles.sectionDescription}>{currentSection.description}</Text> : null}
            </View>
            <View style={styles.sectionStepPill}>
              <Text style={styles.sectionStepPillText}>
                {activeStep + 1}/{activeSections.length}
              </Text>
            </View>
          </View>
          {!currentSection?.isRoot ? (
            <Text style={styles.branchHint}>Same public URL, different follow-up path.</Text>
          ) : null}
        </View>

        {form.collect_email ? (
          <View style={[styles.questionCard, fieldErrors.__email ? styles.questionCardError : null]}>
            <Text style={styles.questionLabel}>
              Email <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              value={respondentEmail}
              onChangeText={(value) => {
                setRespondentEmail(value);
                setFieldErrors((current) => ({ ...current, __email: '' }));
              }}
              placeholder="Your email"
              placeholderTextColor="#5EA0FF"
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setFocusedFieldId('__email')}
              onBlur={() => setFocusedFieldId((current) => (current === '__email' ? null : current))}
              style={[styles.underlineInput, focusedFieldId === '__email' ? styles.underlineInputFocused : null]}
            />
            {fieldErrors.__email ? <Text style={styles.fieldError}>{fieldErrors.__email}</Text> : null}
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {currentSectionQuestions.map((question, index) => (
          <QuestionRenderer
            key={question.id}
            index={index}
            question={question}
            required={requiredQuestionIds.has(question.id)}
            value={answers[question.id] || ''}
            checkboxValues={checkboxAnswers[question.id] || []}
            error={fieldErrors[question.id]}
            openDropdownId={openDropdownId}
            onOpenDropdown={setOpenDropdownId}
            onChange={updateAnswer}
            onToggleCheckbox={toggleCheckboxAnswer}
            fileUploads={fileUploads}
            onTriggerFilePicker={triggerWebFilePicker}
            focusedFieldId={focusedFieldId}
            setFocusedFieldId={setFocusedFieldId}
          />
        ))}

        <View style={styles.footer}>
          {activeStep > 0 ? (
            <TouchableOpacity style={styles.backButton} onPress={goBackStep} disabled={saving}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.submitButton, saving ? styles.submitButtonDisabled : null]}
            onPress={hasNextStep ? goNextStep : handleSubmit}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>{hasNextStep ? 'Continue' : 'Submit'}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={resetForAnotherResponse}>
            <Text style={styles.clearText}>Clear form</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>Never submit passwords through this form.</Text>
      </View>
    </ScrollView>
  );
};

const QuestionRenderer: React.FC<{
  index: number;
  question: PublicQuestion;
  required: boolean;
  value: string;
  checkboxValues: string[];
  error?: string;
  openDropdownId: string | null;
  onOpenDropdown: (id: string | null) => void;
  onChange: (questionId: string, value: string) => void;
  onToggleCheckbox: (questionId: string, optionText: string) => void;
  fileUploads: Record<string, File | null>;
  onTriggerFilePicker: (id: string) => void;
  focusedFieldId: string | null;
  setFocusedFieldId: Dispatch<SetStateAction<string | null>>;
}> = ({
  index,
  question,
  required,
  value,
  checkboxValues,
  error,
  openDropdownId,
  onOpenDropdown,
  onChange,
  onToggleCheckbox,
  fileUploads,
  onTriggerFilePicker,
  focusedFieldId,
  setFocusedFieldId,
}) => {
  const options = (question.options || [])
    .slice()
    .sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0));
  const requiredMark = required ? <Text style={styles.asterisk}> *</Text> : null;

  return (
    <View style={[styles.questionCard, error ? styles.questionCardError : null]}>
      <Text style={styles.questionLabel}>
        {index + 1}. {question.title}
        {requiredMark}
      </Text>

      {question.question_type === 'radio' || question.question_type === 'yes_no' ? (
        <View style={styles.optionGroup}>
          {(question.question_type === 'yes_no' && options.length === 0
            ? [{ option_text: 'Yes' }, { option_text: 'No' }]
            : options
          ).map((option) => {
            const selected = value === option.option_text;
            return (
              <TouchableOpacity
                key={option.option_text}
                style={styles.optionRow}
                onPress={() => onChange(question.id, option.option_text)}
              >
                <View style={[styles.radioOuter, selected ? styles.radioOuterSelected : null]}>
                  {selected ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.optionText}>{option.option_text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : question.question_type === 'checkbox' ? (
        <View style={styles.optionGroup}>
          {options.map((option) => {
            const selected = checkboxValues.includes(option.option_text);
            return (
              <TouchableOpacity
                key={option.option_text}
                style={styles.optionRow}
                onPress={() => onToggleCheckbox(question.id, option.option_text)}
              >
                <View style={[styles.checkboxBox, selected ? styles.checkboxBoxSelected : null]}>
                  {selected ? <Text style={styles.checkboxTick}>✓</Text> : null}
                </View>
                <Text style={styles.optionText}>{option.option_text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : question.question_type === 'dropdown' ? (
        <View>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => onOpenDropdown(openDropdownId === question.id ? null : question.id)}
          >
            <Text style={[styles.dropdownText, value ? styles.dropdownTextSelected : null]}>{value || 'Choose'}</Text>
            <Text style={styles.dropdownChevron}>⌄</Text>
          </TouchableOpacity>
          {openDropdownId === question.id ? (
            <View style={styles.dropdownMenu}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.option_text}
                  style={styles.dropdownItem}
                  onPress={() => {
                    onChange(question.id, option.option_text);
                    onOpenDropdown(null);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{option.option_text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      ) : question.question_type === 'rating' ? (
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((rating) => {
            const selected = value === String(rating);
            return (
              <TouchableOpacity
                key={rating}
                style={[styles.ratingButton, selected ? styles.ratingButtonSelected : null]}
                onPress={() => onChange(question.id, String(rating))}
              >
                <Text style={[styles.ratingText, selected ? styles.ratingTextSelected : null]}>{rating}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : question.question_type === 'date' ? (
        <View>
          {Platform.OS === 'web' ? (
            React.createElement('input', {
              type: 'date',
              value,
              onChange: (event: any) => onChange(question.id, String(event?.target?.value ?? '')),
              onFocus: () => setFocusedFieldId(question.id),
              onBlur: () => setFocusedFieldId((current) => (current === question.id ? null : current)),
              style: {
                ...styles.dateInputWeb,
                ...(focusedFieldId === question.id ? styles.dateInputWebFocused : null),
              },
            })
          ) : (
            <TextInput
              value={value}
              onChangeText={(text) => onChange(question.id, text)}
              placeholder={question.placeholder || 'YYYY-MM-DD'}
              placeholderTextColor="#5EA0FF"
              onFocus={() => setFocusedFieldId(question.id)}
              onBlur={() => setFocusedFieldId((current) => (current === question.id ? null : current))}
              style={[styles.underlineInput, focusedFieldId === question.id ? styles.underlineInputFocused : null]}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
            />
          )}
        </View>
      ) : question.question_type === 'file_upload' ? (
        <View style={styles.fileBox}>
          {Platform.OS === 'web' ? (
            <>
              <TouchableOpacity onPress={() => onTriggerFilePicker(question.id)} style={{ paddingVertical: 8 }}>
                <Text style={{ color: local.purple, fontWeight: '700' }}>
                  {fileUploads[question.id] ? 'Change file' : 'Choose file'}
                </Text>
              </TouchableOpacity>
              {fileUploads[question.id] ? (
                <Text style={styles.fileText}>{String(fileUploads[question.id]?.name)}</Text>
              ) : (
                <Text style={styles.fileText}>No file selected</Text>
              )}
            </>
          ) : (
            <Text style={styles.fileText}>File upload is available in the authenticated app flow.</Text>
          )}
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={(text) => onChange(question.id, text)}
          placeholder={question.placeholder || 'Your answer'}
          placeholderTextColor="#5EA0FF"
          onFocus={() => setFocusedFieldId(question.id)}
          onBlur={() => setFocusedFieldId((current) => (current === question.id ? null : current))}
          style={[
            styles.underlineInput,
            focusedFieldId === question.id ? styles.underlineInputFocused : null,
            question.question_type === 'paragraph' ? styles.textArea : null,
          ]}
          multiline={question.question_type === 'paragraph'}
          keyboardType={
            question.question_type === 'email'
              ? 'email-address'
              : question.question_type === 'number'
                ? 'numeric'
                : 'default'
          }
          autoCapitalize={question.question_type === 'email' ? 'none' : 'sentences'}
        />
      )}

      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
};

const getClientHints = () => {
  const nav = (globalThis as { navigator?: Navigator }).navigator;
  const userAgent = String(nav?.userAgent || 'Unknown');
  const browser = userAgent.includes('Edg')
    ? 'Edge'
    : userAgent.includes('Chrome')
      ? 'Chrome'
      : userAgent.includes('Firefox')
        ? 'Firefox'
        : userAgent.includes('Safari')
          ? 'Safari'
          : 'Unknown';
  const device = /Mobi|Android/i.test(userAgent) ? 'Mobile' : 'Desktop';
  return { device, browser };
};

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 16, paddingBottom: 40, backgroundColor: '#F6F5FF', position: 'relative', overflow: 'hidden' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: local.page, padding: 20 },
  backgroundLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgGlowOne: { position: 'absolute', top: -70, left: -90, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(91, 75, 255, 0.16)' },
  bgGlowTwo: { position: 'absolute', top: 140, right: -110, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(46, 166, 255, 0.14)' },
  bgGlowThree: { position: 'absolute', bottom: -120, left: '16%', width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(168, 111, 255, 0.10)' },
  formShell: { width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
    marginBottom: 12,
    shadowColor: 'rgba(49, 34, 111, 0.10)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
  title: { color: local.ink, fontSize: 32, lineHeight: 39, fontWeight: '800', marginBottom: 12 },
  description: { color: local.ink, fontSize: 16, lineHeight: 23, marginBottom: 14 },
  headerDivider: { height: 1, backgroundColor: local.softLine, marginVertical: 10 },
  requiredNote: { color: local.danger, fontSize: 14 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
    marginBottom: 12,
    shadowColor: 'rgba(49, 34, 111, 0.10)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
  sectionCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  sectionCardCopy: { flex: 1, paddingRight: 8 },
  sectionEyebrow: { color: local.purple, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionTitle: { color: local.ink, fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 4 },
  sectionDescription: { color: local.muted, marginTop: 8, lineHeight: 20 },
  sectionStepPill: { backgroundColor: '#F3F0FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  sectionStepPillText: { color: local.purple, fontSize: 12, fontWeight: '900' },
  branchHint: { color: local.purple, marginTop: 10, fontSize: 13, fontWeight: '700' },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
    shadowColor: 'rgba(49, 34, 111, 0.12)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
  questionCardError: { borderColor: local.danger, borderLeftWidth: 6 },
  questionLabel: { color: local.ink, fontSize: 16, lineHeight: 24, marginBottom: 18 },
  asterisk: { color: local.danger },
  underlineInput: {
    minHeight: 50,
    maxWidth: 420,
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 10,
    color: local.ink,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.16)',
    borderRadius: 14,
    backgroundColor: '#F6F9FF',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(91, 75, 255, 0.34)',
    shadowColor: 'rgba(91, 75, 255, 0.14)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 2,
    ...webInputReset,
  },
  underlineInputFocused: {
    borderColor: 'rgba(91, 75, 255, 0.34)',
    borderBottomColor: local.purple,
    backgroundColor: '#EEF4FF',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 3,
  },
  textArea: { minHeight: 96, maxWidth: 560, textAlignVertical: 'top' },
  optionGroup: { marginTop: -4 },
  optionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 42, marginBottom: 4 },
  optionText: { color: local.ink, fontSize: 16 },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#5F6368', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  radioOuterSelected: { borderColor: local.purple },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: local.purple },
  checkboxBox: { width: 20, height: 20, borderRadius: 2, borderWidth: 2, borderColor: '#5F6368', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  checkboxBoxSelected: { backgroundColor: local.purple, borderColor: local.purple },
  checkboxTick: { color: '#FFFFFF', fontWeight: '900', fontSize: 14, lineHeight: 16 },
  dropdownButton: {
    maxWidth: 320,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.16)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F6F9FF',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(91, 75, 255, 0.34)',
    shadowColor: 'rgba(91, 75, 255, 0.14)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 2,
  },
  dropdownText: { color: local.muted, fontSize: 16 },
  dropdownTextSelected: { color: local.ink },
  dropdownChevron: { color: local.muted, fontSize: 22, marginLeft: 18 },
  dropdownMenu: {
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.18)',
    borderRadius: 14,
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: local.softLine },
  dropdownItemText: { color: local.ink },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap' },
  ratingButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: local.line, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginBottom: 8 },
  ratingButtonSelected: { backgroundColor: local.purple, borderColor: local.purple },
  ratingText: { color: local.ink, fontWeight: '700' },
  ratingTextSelected: { color: '#FFFFFF' },
  fileBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.16)',
    padding: 14,
    backgroundColor: '#F6F9FF',
    shadowColor: 'rgba(91, 75, 255, 0.14)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 2,
  },
  fileText: { color: local.muted },
  dateInputWeb: {
    width: '100%',
    maxWidth: 320,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.16)',
    paddingHorizontal: 14,
    color: local.ink,
    fontSize: 16,
    backgroundColor: '#F6F9FF',
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(91, 75, 255, 0.34)',
    shadowColor: 'rgba(91, 75, 255, 0.14)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 2,
    ...webInputReset,
  },
  dateInputWebFocused: {
    borderColor: 'rgba(91, 75, 255, 0.34)',
    borderBottomColor: local.purple,
    backgroundColor: '#EEF4FF',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 3,
  },
  fieldError: { color: local.danger, marginTop: 12, fontSize: 14 },
  errorText: { color: local.danger, backgroundColor: '#EEF2FF', borderRadius: 8, padding: 12, marginBottom: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 18, gap: 10, flexWrap: 'wrap' },
  backButton: { minWidth: 92, minHeight: 42, borderRadius: 4, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderWidth: 1, borderColor: local.line },
  backButtonText: { color: local.ink, fontWeight: '700' },
  submitButton: { minWidth: 104, minHeight: 42, borderRadius: 4, backgroundColor: local.purple, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  submitButtonDisabled: { opacity: 0.72 },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700' },
  clearText: { color: local.purple, fontWeight: '700' },
  disclaimer: { color: local.muted, textAlign: 'center', fontSize: 14 },
  thankYouCard: { backgroundColor: '#FFFFFF', padding: 28, borderRadius: 8, borderWidth: 1, borderColor: local.line },
  successIcon: { color: local.success, fontSize: 34, marginBottom: 10 },
  thankYouText: { color: local.ink, fontSize: 16, marginBottom: 20 },
  submitAnother: { alignSelf: 'flex-start' },
  submitAnotherText: { color: local.purple, fontWeight: '700' },
});



