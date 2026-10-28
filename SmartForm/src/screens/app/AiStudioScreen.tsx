import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppStackParamList } from '../../navigation/NavigationTypes';
import { aiService, AiFormBuilderResponse } from '../../api/ai-service';
import { formsService } from '../../api/forms-service';
import { questionsService, QuestionType } from '../../api/questions-service';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { webInputReset } from '../../utils/webInputReset';

type BuilderQuestion = AiFormBuilderResponse['questions'][number] & {
  id: string;
  question_type: QuestionType;
};

type TemplatePreset = {
  title: string;
  description: string;
  objective: string;
  audience?: string;
  tone?: string;
  includeEmail?: boolean;
};

const QUESTION_TYPE_ALIASES: Record<string, QuestionType> = {
  long_text: 'paragraph',
  text: 'short_text',
  single_choice: 'radio',
  multiple_choice: 'checkbox',
  multi_select: 'checkbox',
  single_select: 'radio',
  yesno: 'yes_no',
  yes_no: 'yes_no',
  email_address: 'email',
  phone_number: 'phone',
};

const CHOICE_TYPES = new Set<QuestionType>(['dropdown', 'checkbox', 'radio', 'yes_no']);

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_text: 'Short Text',
  paragraph: 'Paragraph',
  email: 'Email',
  phone: 'Phone',
  number: 'Number',
  date: 'Date',
  time: 'Time',
  dropdown: 'Dropdown',
  checkbox: 'Checkbox',
  radio: 'Radio',
  rating: 'Rating',
  yes_no: 'Yes / No',
  file_upload: 'File Upload',
  url: 'URL',
  password: 'Password',
  signature: 'Signature',
  section_title: 'Section Title',
  image: 'Image',
};

const QUESTION_TYPES: QuestionType[] = [
  'short_text',
  'paragraph',
  'email',
  'phone',
  'number',
  'date',
  'time',
  'dropdown',
  'checkbox',
  'radio',
  'rating',
  'yes_no',
  'file_upload',
  'url',
  'password',
  'signature',
];

const DEFAULT_CHOICES = ['Option 1', 'Option 2'];
const DEFAULT_YES_NO = ['Yes', 'No'];
const buildId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const TEMPLATES: TemplatePreset[] = [
  {
    title: 'Student Registration',
    description: 'Collect student and academic details for onboarding.',
    objective: 'Create a college student registration form for Infosys Springboard.',
    audience: 'college students',
    tone: 'clear and professional',
    includeEmail: true,
  },
  {
    title: 'School Admission',
    description: 'Capture student, parent, academic, and document details.',
    objective: 'Create a school admission form with student details, parent details, academic information and document upload.',
    audience: 'parents and guardians',
    tone: 'warm and trustworthy',
    includeEmail: true,
  },
  {
    title: 'Job Application',
    description: 'Screen applicants with experience, skills, and availability.',
    objective: 'Create a job application form for candidates applying to an open role.',
    audience: 'job applicants',
    tone: 'professional and concise',
    includeEmail: true,
  },
  {
    title: 'Event Registration',
    description: 'Register attendees and collect the right logistics.',
    objective: 'Create an event registration form for attendees, speakers, and volunteers.',
    audience: 'event attendees',
    tone: 'friendly and energetic',
    includeEmail: true,
  },
  {
    title: 'Course Signup',
    description: 'Capture learning goals and availability before enrollment.',
    objective: 'Create a course registration form for learners who want to enroll in a new class.',
    audience: 'learners',
    tone: 'clear and encouraging',
    includeEmail: true,
  },
  {
    title: 'Customer Feedback',
    description: 'Collect product or service feedback with a simple flow.',
    objective: 'Create a customer feedback form with ratings, comments, and improvement suggestions.',
    audience: 'customers',
    tone: 'friendly and concise',
    includeEmail: false,
  },
];

const palette = {
  page: '#F3EEFF',
  surface: '#FCF9FF',
  surfaceSoft: '#F5F0FF',
  ink: '#152033',
  muted: '#667085',
  line: '#E5DBFF',
  primary: '#5B4BFF',
  secondary: '#2EA6FF',
  success: '#0F9D8A',
  amber: '#D88B20',
  danger: '#D9576B',
  white: '#FFFFFF',
};

const getQuestionType = (value: string): QuestionType => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_');
  const direct = QUESTION_TYPES.find((type) => type === normalized);
  if (direct) return direct;
  return QUESTION_TYPE_ALIASES[normalized] ?? 'short_text';
};

const getDefaultPlaceholder = (type: QuestionType) => {
  const map: Partial<Record<QuestionType, string>> = {
    short_text: 'Short answer',
    paragraph: 'Long answer',
    email: 'Enter your email',
    phone: 'Enter your phone number',
    number: 'Enter a number',
    date: 'Pick a date',
    time: 'Pick a time',
    dropdown: 'Choose an option',
    checkbox: 'Select one or more options',
    radio: 'Select one option',
    rating: 'Rate from 1 to 5',
    yes_no: 'Choose yes or no',
    file_upload: 'Upload a file',
    url: 'https://example.com',
    password: 'Enter a password',
    signature: 'Add signature',
    section_title: 'Section heading',
    image: 'Add an image',
  };
  return map[type] ?? 'Enter your answer';
};

const normalizeQuestion = (question: AiFormBuilderResponse['questions'][number], index: number): BuilderQuestion => {
  const questionType = getQuestionType(question.question_type);
  return {
    ...question,
    id: buildId(),
    question_type: questionType,
    required: question.required ?? true,
    placeholder: question.placeholder ?? getDefaultPlaceholder(questionType),
    options:
      questionType === 'yes_no' && question.options.length === 0
        ? DEFAULT_YES_NO.slice()
        : question.options.length > 0
          ? question.options.slice()
          : CHOICE_TYPES.has(questionType)
            ? DEFAULT_CHOICES.slice()
            : [],
  };
};

const toPayloadQuestions = (questions: BuilderQuestion[]) =>
  questions.map(({ id: _id, question_type, ...question }) => ({
    ...question,
    question_type,
    options: question.options.slice(),
  }));

export const AiStudioScreen: React.FC<NativeStackScreenProps<AppStackParamList, 'AiStudio'>> = ({ navigation }) => {
  const { user } = useAuth();
  const [objective, setObjective] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('clear and professional');
  const [questionCount, setQuestionCount] = useState('7');
  const [includeEmail, setIncludeEmail] = useState(true);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [builderLoading, setBuilderLoading] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);
  const [result, setResult] = useState<AiFormBuilderResponse | null>(null);
  const [questions, setQuestions] = useState<BuilderQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editorVisible, setEditorVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorType, setEditorType] = useState<QuestionType>('short_text');
  const [editorRequired, setEditorRequired] = useState(true);
  const [editorPlaceholder, setEditorPlaceholder] = useState('');
  const [editorOptions, setEditorOptions] = useState<string[]>(DEFAULT_CHOICES);

  const templates = TEMPLATES;

  const resetEditor = () => {
    setEditingId(null);
    setEditorTitle('');
    setEditorType('short_text');
    setEditorRequired(true);
    setEditorPlaceholder(getDefaultPlaceholder('short_text'));
    setEditorOptions(DEFAULT_CHOICES.slice());
  };

  const openEditor = (question?: BuilderQuestion) => {
    if (!question) {
      resetEditor();
      setEditorVisible(true);
      return;
    }

    setEditingId(question.id);
    setEditorTitle(question.title);
    setEditorType(question.question_type);
    setEditorRequired(question.required);
    setEditorPlaceholder(question.placeholder ?? getDefaultPlaceholder(question.question_type));
    setEditorOptions(
      CHOICE_TYPES.has(question.question_type)
        ? question.options.length > 0
          ? question.options.slice()
          : question.question_type === 'yes_no'
            ? DEFAULT_YES_NO.slice()
            : DEFAULT_CHOICES.slice()
        : [],
    );
    setEditorVisible(true);
  };

  const saveQuestion = () => {
    const title = editorTitle.trim();
    if (!title) {
      setError('Question title is required.');
      return;
    }

    const payload: BuilderQuestion = {
      id: editingId ?? buildId(),
      title,
      question_type: editorType,
      required: editorRequired,
      placeholder: editorPlaceholder.trim() || getDefaultPlaceholder(editorType),
      options: CHOICE_TYPES.has(editorType) ? editorOptions.map((option) => option.trim()).filter(Boolean) : [],
      validation: null,
    };

    const nextQuestions = editingId
      ? questions.map((question) => (question.id === editingId ? payload : question))
      : [...questions, payload];

    setQuestions(nextQuestions);
    setResult((current) => (current ? { ...current, questions: toPayloadQuestions(nextQuestions) } : current));
    setEditorVisible(false);
    resetEditor();
  };

  const removeQuestion = (id: string) => {
    const nextQuestions = questions.filter((question) => question.id !== id);
    setQuestions(nextQuestions);
    setResult((current) => (current ? { ...current, questions: toPayloadQuestions(nextQuestions) } : current));
  };

  const moveQuestion = (id: string, direction: -1 | 1) => {
    const index = questions.findIndex((question) => question.id === id);
    if (index < 0) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= questions.length) return;

    const nextQuestions = questions.slice();
    const [item] = nextQuestions.splice(index, 1);
    nextQuestions.splice(nextIndex, 0, item);
    setQuestions(nextQuestions);
    setResult((current) => (current ? { ...current, questions: toPayloadQuestions(nextQuestions) } : current));
  };

  const runGenerate = async (overrideObjective?: string, overrideContext?: string) => {
    const targetObjective = (overrideObjective ?? objective).trim();
    if (!targetObjective) {
      setError('Describe the form you want to build.');
      return;
    }

    const parsedCount = Number.parseInt(questionCount, 10);
    const count = Number.isFinite(parsedCount) ? Math.min(15, Math.max(3, parsedCount)) : 7;

    try {
      setBuilderLoading(true);
      setError(null);
      setQuestionCount(String(count));

      const response = await aiService.buildForm({
        objective: targetObjective,
        audience: audience.trim() || undefined,
        tone: tone.trim() || undefined,
        question_count: count,
        include_email: includeEmail,
        context: overrideContext,
      });

      const nextQuestions = response.questions.map((question, index) => normalizeQuestion(question, index));
      setResult(response);
      setQuestions(nextQuestions);
      setRefinePrompt('');
      resetEditor();
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      Alert.alert('AI form builder failed', message);
    } finally {
      setBuilderLoading(false);
    }
  };

  const applyTemplate = (template: TemplatePreset) => {
    setObjective(template.objective);
    setAudience(template.audience ?? '');
    setTone(template.tone ?? 'clear and professional');
    setIncludeEmail(template.includeEmail ?? true);
    void runGenerate(template.objective, JSON.stringify(template, null, 2));
  };

  const refineForm = () => {
    if (!result) {
      setError('Generate a form first, then ask for changes.');
      return;
    }

    const context = JSON.stringify(
      {
        current_form: {
          title: result.title,
          description: result.description,
          rationale: result.rationale,
          suggested_tags: result.suggested_tags,
          next_steps: result.next_steps,
          questions: toPayloadQuestions(questions),
        },
        refinement_request: refinePrompt.trim(),
      },
      null,
      2,
    );

    void runGenerate(
      refinePrompt.trim() ? `${objective.trim()} - refinement: ${refinePrompt.trim()}` : objective,
      context,
    );
  };

  const saveGeneratedForm = async (publishImmediately: boolean) => {
    if (!user) {
      setError('Please sign in to save generated forms.');
      return;
    }
    if (!result) {
      setError('Generate a form blueprint first.');
      return;
    }
    if (questions.length === 0) {
      setError('Add at least one question before saving.');
      return;
    }

    try {
      setSaving(publishImmediately ? 'publish' : 'draft');
      setError(null);

      const form = await formsService.create({
        owner_id: user.id,
        title: result.title.trim(),
        description: result.description.trim() || undefined,
        status: 'draft',
        collect_email: includeEmail,
      });

      for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index];
        const options = CHOICE_TYPES.has(question.question_type)
          ? question.options.length > 0
            ? question.options
            : question.question_type === 'yes_no'
              ? DEFAULT_YES_NO
              : DEFAULT_CHOICES
          : [];

        await questionsService.create({
          form_id: form.id,
          title: question.title,
          question_type: question.question_type,
          placeholder: question.placeholder?.trim() || null,
          required: question.required,
          order_index: index,
          validation: question.validation ?? null,
          options: options.map((option, optionIndex) => ({
            option_text: option,
            order_index: optionIndex,
          })),
        });
      }

      const finalForm = publishImmediately ? await formsService.publish(form.id) : form;
      Alert.alert(
        publishImmediately ? 'Form published' : 'Draft saved',
        publishImmediately
          ? 'Your generated form is live and ready for responses.'
          : 'Your generated form is saved as a draft.',
      );
      navigation.replace('FormDetail', { formId: finalForm.id });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      Alert.alert('Saving generated form failed', message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#F8F4FF', '#EEF5FF', '#F9FBFF']} style={styles.background}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.85}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}
            >
              <Feather name="arrow-left" size={18} color={palette.primary} />
            </TouchableOpacity>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>AI Form Builder</Text>
              <Text style={styles.title}>Describe it. We build it.</Text>
              <Text style={styles.subtitle}>
                Turn natural language into a complete form blueprint with sections, question types, validations, and editable questions.
              </Text>
            </View>
            <View style={styles.headerChip}>
              <Feather name="zap" size={14} color={palette.primary} />
              <Text style={styles.headerChipText}>Gemini powered</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>We hit a snag</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.heroCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.96)', 'rgba(242,236,255,0.96)', 'rgba(233,244,255,0.94)']}
              style={styles.heroGradient}
            >
              <View style={styles.heroCopy}>
                <View style={styles.heroBadge}>
                  <Feather name="star" size={14} color={palette.primary} />
                  <Text style={styles.heroBadgeText}>Prompt to form</Text>
                </View>
                <Text style={styles.heroTitle}>
                  Type the form you want. AI creates the structure, you polish it, then publish.
                </Text>
                <Text style={styles.heroText}>
                  Use templates for common flows or write your own instruction. The generated form stays editable before it becomes live.
                </Text>
                <View style={styles.heroActions}>
                  <TouchableOpacity style={styles.primaryButton} onPress={() => void runGenerate()} disabled={builderLoading}>
                    {builderLoading ? <ActivityIndicator size="small" color={palette.white} /> : <Text style={styles.primaryButtonText}>Generate form</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setObjective('')} disabled={builderLoading}>
                    <Text style={styles.secondaryButtonText}>Clear prompt</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.heroStats}>
                <StatCard label="Templates" value={String(TEMPLATES.length)} caption="ready to use" />
                <StatCard label="Status" value={result ? 'Generated' : 'Draft'} caption={result ? 'you can edit now' : 'start with a prompt'} />
                <StatCard label="Mode" value="AI Studio" caption="builder only" />
              </View>
            </LinearGradient>
          </View>

          <View style={styles.grid}>
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>Prompt</Text>
                  <Text style={styles.sectionTitle}>Describe the form</Text>
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>What should AI create?</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={objective}
                  onChangeText={setObjective}
                  placeholder="Create a school admission form with student details, parent details, academic information and document upload."
                  placeholderTextColor="#8A86A7"
                  multiline
                />
              </View>

              <View style={styles.twoCol}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Audience</Text>
                  <TextInput
                    style={styles.input}
                    value={audience}
                    onChangeText={setAudience}
                    placeholder="parents, students, applicants..."
                    placeholderTextColor="#8A86A7"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Tone</Text>
                  <TextInput
                    style={styles.input}
                    value={tone}
                    onChangeText={setTone}
                    placeholder="clear and professional"
                    placeholderTextColor="#8A86A7"
                  />
                </View>
              </View>

              <View style={styles.twoCol}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Question count</Text>
                  <TextInput
                    style={styles.input}
                    value={questionCount}
                    onChangeText={setQuestionCount}
                    keyboardType="number-pad"
                    placeholder="7"
                    placeholderTextColor="#8A86A7"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Collect email</Text>
                  <View style={styles.toggleRow}>
                    <TogglePill label="Yes" active={includeEmail} onPress={() => setIncludeEmail(true)} />
                    <TogglePill label="No" active={!includeEmail} onPress={() => setIncludeEmail(false)} />
                  </View>
                </View>
              </View>

              <View style={styles.helperRow}>
                <Text style={styles.helperText}>
                  Tip: add the form goal, audience, and any required sections. AI will decide question types and basic validation.
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>Templates</Text>
                  <Text style={styles.sectionTitle}>Start from a preset</Text>
                </View>
              </View>
              <View style={styles.templateGrid}>
                {templates.map((template) => (
                  <TouchableOpacity key={template.title} style={styles.templateCard} onPress={() => applyTemplate(template)} activeOpacity={0.88}>
                    <View style={styles.templateIcon}>
                      <Feather name="file-text" size={16} color={palette.primary} />
                    </View>
                    <Text style={styles.templateTitle}>{template.title}</Text>
                    <Text style={styles.templateText}>{template.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {result ? (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>Generated</Text>
                  <Text style={styles.sectionTitle}>{result.title}</Text>
                </View>
                <View style={styles.sectionPill}>
                  <Text style={styles.sectionPillText}>{questions.length} questions</Text>
                </View>
              </View>

              <Text style={styles.resultText}>{result.description}</Text>
              {result.rationale ? <Text style={styles.resultRationale}>{result.rationale}</Text> : null}

              {result.suggested_tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {result.suggested_tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.listHeaderRow}>
                <Text style={styles.listTitle}>Form blueprint</Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => openEditor()}>
                  <Text style={styles.secondaryButtonText}>Add question</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.listBlock}>
                {questions.map((question, index) => (
                  <View key={question.id} style={styles.questionCard}>
                    <View style={styles.questionTopRow}>
                      <View style={styles.questionCopy}>
                        <Text style={styles.questionIndex}>Q{index + 1}</Text>
                        <Text style={styles.questionTitle}>{question.title}</Text>
                        <View style={styles.metaRow}>
                          <View style={styles.typeBadge}>
                            <Text style={styles.typeBadgeText}>{QUESTION_TYPE_LABELS[question.question_type]}</Text>
                          </View>
                          <Text style={styles.metaText}>{question.required ? 'Required' : 'Optional'}</Text>
                        </View>
                        {question.placeholder ? <Text style={styles.helperText}>{question.placeholder}</Text> : null}
                        {question.options.length > 0 ? (
                          <Text style={styles.optionPreview}>
                            Options: {question.options.join(' • ')}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.rowActions}>
                        <TouchableOpacity style={styles.iconAction} onPress={() => moveQuestion(question.id, -1)} disabled={index === 0}>
                          <Feather name="chevron-up" size={16} color={index === 0 ? '#A1A1AA' : palette.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconAction} onPress={() => moveQuestion(question.id, 1)} disabled={index === questions.length - 1}>
                          <Feather name="chevron-down" size={16} color={index === questions.length - 1 ? '#A1A1AA' : palette.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.iconAction} onPress={() => openEditor(question)}>
                          <Feather name="edit-3" size={16} color={palette.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconAction, styles.iconActionDanger]} onPress={() => removeQuestion(question.id)}>
                          <Feather name="trash-2" size={16} color={palette.danger} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}

                {questions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>No questions yet</Text>
                    <Text style={styles.emptyText}>Generate a form or add questions manually to build the blueprint.</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.refineCard}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionEyebrow}>Refine</Text>
                    <Text style={styles.sectionTitle}>Ask AI to modify this form</Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={refinePrompt}
                  onChangeText={setRefinePrompt}
                  placeholder='Add an emergency contact section. Make phone mandatory.'
                  placeholderTextColor="#8A86A7"
                  multiline
                />
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.secondaryButton} onPress={refineForm} disabled={builderLoading}>
                    <Text style={styles.secondaryButtonText}>Refine with AI</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setQuestions([])} disabled={builderLoading}>
                    <Text style={styles.secondaryButtonText}>Clear questions</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => void saveGeneratedForm(false)} disabled={saving !== null}>
                  {saving === 'draft' ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <Text style={styles.secondaryButtonText}>Save draft</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={() => void saveGeneratedForm(true)} disabled={saving !== null}>
                  {saving === 'publish' ? (
                    <ActivityIndicator size="small" color={palette.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save & publish</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <Modal visible={editorVisible} transparent animationType="fade" onRequestClose={() => setEditorVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalEyebrow}>Edit question</Text>
                    <Text style={styles.modalTitle}>{editingId ? 'Update question' : 'Add question'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => {
                      setEditorVisible(false);
                      resetEditor();
                    }}
                  >
                    <Feather name="x" size={18} color={palette.muted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Question text</Text>
                  <TextInput
                    style={styles.input}
                    value={editorTitle}
                    onChangeText={setEditorTitle}
                    placeholder="What is your full name?"
                    placeholderTextColor="#8A86A7"
                  />
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
                    {QUESTION_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[styles.typeChip, editorType === type ? styles.typeChipActive : null]}
                        onPress={() => {
                          setEditorType(type);
                          setEditorPlaceholder(getDefaultPlaceholder(type));
                          setEditorOptions(
                            CHOICE_TYPES.has(type)
                              ? type === 'yes_no'
                                ? DEFAULT_YES_NO.slice()
                                : DEFAULT_CHOICES.slice()
                              : [],
                          );
                        }}
                      >
                        <Text style={[styles.typeChipText, editorType === type ? styles.typeChipTextActive : null]}>
                          {QUESTION_TYPE_LABELS[type]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.twoCol}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Placeholder</Text>
                    <TextInput
                      style={styles.input}
                      value={editorPlaceholder}
                      onChangeText={setEditorPlaceholder}
                      placeholder="Enter answer"
                      placeholderTextColor="#8A86A7"
                    />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Required</Text>
                    <View style={styles.toggleRow}>
                      <TogglePill label="Yes" active={editorRequired} onPress={() => setEditorRequired(true)} />
                      <TogglePill label="No" active={!editorRequired} onPress={() => setEditorRequired(false)} />
                    </View>
                  </View>
                </View>

                {CHOICE_TYPES.has(editorType) ? (
                  <View style={styles.fieldGroup}>
                    <View style={styles.listHeaderRow}>
                      <Text style={styles.label}>Options</Text>
                      <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditorOptions((current) => [...current, `Option ${current.length + 1}`])}>
                        <Text style={styles.secondaryButtonText}>Add option</Text>
                      </TouchableOpacity>
                    </View>
                    {editorOptions.map((option, index) => (
                      <View key={`${option}-${index}`} style={styles.optionRow}>
                        <TextInput
                          style={[styles.input, styles.optionInput]}
                          value={option}
                          onChangeText={(text) => {
                            const next = editorOptions.slice();
                            next[index] = text;
                            setEditorOptions(next);
                          }}
                          placeholder={`Option ${index + 1}`}
                          placeholderTextColor="#8A86A7"
                        />
                        <TouchableOpacity
                          style={[styles.iconAction, editorOptions.length <= 1 ? styles.iconActionDisabled : null]}
                          disabled={editorOptions.length <= 1}
                          onPress={() => setEditorOptions((current) => current.filter((_, optionIndex) => optionIndex !== index))}
                        >
                          <Feather name="trash-2" size={16} color={editorOptions.length <= 1 ? '#A1A1AA' : palette.danger} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setEditorVisible(false);
                      resetEditor();
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.primaryButton} onPress={saveQuestion}>
                    <Text style={styles.primaryButtonText}>{editingId ? 'Save question' : 'Add question'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
};

const StatCard: React.FC<{ label: string; value: string; caption: string }> = ({ label, value, caption }) => (
  <View style={styles.statCard}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statCaption}>{caption}</Text>
  </View>
);

const TogglePill: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => (
  <TouchableOpacity style={[styles.togglePill, active ? styles.togglePillActive : null]} onPress={onPress} activeOpacity={0.85}>
    <Text style={[styles.togglePillText, active ? styles.togglePillTextActive : null]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  background: { flex: 1, position: 'relative' },
  glowOne: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(91, 75, 255, 0.12)',
  },
  glowTwo: {
    position: 'absolute',
    left: -80,
    bottom: 40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(46, 166, 255, 0.10)',
  },
  container: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  subtitle: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    fontWeight: '600',
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerChipText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },
  errorCard: {
    marginBottom: 12,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(217, 87, 107, 0.24)',
    backgroundColor: 'rgba(255, 240, 243, 0.96)',
  },
  errorTitle: {
    color: palette.danger,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  errorText: {
    color: palette.danger,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 14,
  },
  heroGradient: {
    padding: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.14)',
    flexDirection: 'row',
    gap: 16,
    alignItems: 'stretch',
  },
  heroCopy: { flex: 1.2 },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  heroBadgeText: {
    marginLeft: 6,
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 14,
    color: palette.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    maxWidth: 640,
  },
  heroText: {
    marginTop: 10,
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 640,
    fontWeight: '600',
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  heroStats: {
    flex: 0.8,
    gap: 10,
    minWidth: 220,
  },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(229, 219, 255, 0.72)',
  },
  statLabel: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  statValue: {
    marginTop: 6,
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  statCaption: {
    marginTop: 4,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  card: {
    flex: 1,
    minWidth: 320,
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionEyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    marginTop: 4,
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  sectionPillText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  fieldGroup: {
    marginTop: 12,
  },
  label: {
    marginBottom: 8,
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  input: {
    backgroundColor: 'rgba(247, 241, 255, 0.88)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.ink,
    fontSize: 15,
    borderWidth: 1,
    borderColor: palette.line,
    ...webInputReset,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  helperRow: {
    marginTop: 10,
    paddingTop: 4,
  },
  helperText: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  togglePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.line,
  },
  togglePillActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  togglePillText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '900',
  },
  togglePillTextActive: {
    color: palette.white,
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: '900',
  },
  templateGrid: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  templateCard: {
    flexGrow: 1,
    minWidth: 180,
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.line,
  },
  templateIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  templateTitle: {
    marginTop: 10,
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  templateText: {
    marginTop: 6,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  resultText: {
    marginTop: 12,
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  resultRationale: {
    marginTop: 8,
    color: palette.ink,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
  },
  tagText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  listHeaderRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  listTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  listBlock: {
    marginTop: 10,
    gap: 10,
  },
  questionCard: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: '#FFFFFF',
  },
  questionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  questionCopy: {
    flex: 1,
  },
  questionIndex: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  questionTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
  },
  typeBadgeText: {
    color: palette.primary,
    fontSize: 10,
    fontWeight: '900',
  },
  metaText: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  optionPreview: {
    marginTop: 6,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconAction: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.line,
  },
  iconActionDanger: {
    backgroundColor: 'rgba(255, 240, 243, 0.96)',
    borderColor: 'rgba(217, 87, 107, 0.18)',
  },
  iconActionDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: 'rgba(248, 250, 255, 0.96)',
    alignItems: 'center',
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 6,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '600',
  },
  refineCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(248, 250, 255, 0.96)',
    borderWidth: 1,
    borderColor: palette.line,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  typeRow: {
    gap: 8,
    paddingVertical: 4,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surfaceSoft,
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  typeChipText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  typeChipTextActive: {
    color: palette.white,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.54)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    maxHeight: '92%',
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    overflow: 'hidden',
  },
  modalContent: {
    padding: 18,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  modalEyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: '900',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.line,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  optionInput: {
    flex: 1,
  },
  formChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  formChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: palette.surfaceSoft,
    borderWidth: 1,
    borderColor: palette.line,
  },
  formChipActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  formChipText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 180,
  },
  formChipTextActive: {
    color: palette.white,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingRowText: {
    color: palette.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  analysisPanel: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(248, 250, 255, 0.96)',
    borderWidth: 1,
    borderColor: palette.line,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  metricChip: {
    minWidth: 140,
    flexGrow: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.line,
  },
  metricChipLabel: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metricChipValue: {
    marginTop: 6,
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  metricChipDetail: {
    marginTop: 4,
    color: palette.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  nextQuestionBox: {
    marginTop: 14,
    paddingTop: 4,
  },
  analysisBlock: {
    marginTop: 14,
  },
  analysisBlockTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  analysisItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  analysisDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  analysisItemText: {
    flex: 1,
    color: palette.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  analysisEmpty: {
    color: palette.muted,
    fontSize: 13,
    fontStyle: 'italic',
  },
});

const AnalysisBlock: React.FC<{ title: string; items: string[]; color: string }> = ({ title, items, color }) => (
  <View style={styles.analysisBlock}>
    <Text style={[styles.analysisBlockTitle, { color }]}>{title}</Text>
    {items.length > 0 ? (
      items.map((item, index) => (
        <View key={`${title}-${index}`} style={styles.analysisItem}>
          <View style={[styles.analysisDot, { backgroundColor: color }]} />
          <Text style={styles.analysisItemText}>{item}</Text>
        </View>
      ))
    ) : (
      <Text style={styles.analysisEmpty}>No items returned.</Text>
    )}
  </View>
);
