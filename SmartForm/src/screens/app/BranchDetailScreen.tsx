import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/NavigationTypes';
import { formsService } from '../../api/forms-service';
import { questionsService, QuestionItem, QuestionType } from '../../api/questions-service';
import { questionBranchesService, QuestionBranchItem } from '../../api/question-branches-service';
import { getErrorMessage } from '../../api/client';
import { questionTypes } from './FormDetailScreen';
import { webInputReset } from '../../utils/webInputReset';

const local = {
  ink: '#172033',
  muted: '#6b7280',
  line: '#e7ebf6',
  soft: '#f7f8fc',
  blue: '#5b4bff',
  amber: '#f59e0b',
  red: '#ef4444',
};

export const BranchDetailScreen: React.FC<NativeStackScreenProps<AppStackParamList, 'BranchDetail'>> = ({ route, navigation }) => {
  const { formId, triggerQuestionId, branchId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [branches, setBranches] = useState<QuestionBranchItem[]>([]);
  const [triggerQuestion, setTriggerQuestion] = useState<QuestionItem | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(branchId ?? null);

  const [branchTitle, setBranchTitle] = useState('');
  const [branchDescription, setBranchDescription] = useState('');
  const [branchTriggerOption, setBranchTriggerOption] = useState('');

  const [questionTitle, setQuestionTitle] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('short_text');
  const [questionPlaceholder, setQuestionPlaceholder] = useState('Short answer');
  const [questionRequired, setQuestionRequired] = useState(false);
  const [questionOptions, setQuestionOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const triggerOptions = useMemo(() => {
    if (!triggerQuestion) return [];
    if (triggerQuestion.question_type === 'yes_no' && triggerQuestion.options.length === 0) {
      return ['Yes', 'No'];
    }
    return triggerQuestion.options.map((option) => option.option_text);
  }, [triggerQuestion]);

  const branchesForTrigger = useMemo(
    () => branches.filter((branch) => branch.trigger_question_id === triggerQuestionId).sort((a, b) => a.order_index - b.order_index),
    [branches, triggerQuestionId],
  );

  const branchByOption = useMemo(() => {
    const map = new Map<string, QuestionBranchItem>();
    branchesForTrigger.forEach((branch) => {
      map.set(branch.trigger_option_text.trim().toLowerCase(), branch);
    });
    return map;
  }, [branchesForTrigger]);

  const selectedBranch = useMemo(
    () => branches.find((branch) => branch.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const branchQuestions = useMemo(
    () =>
      questions
        .filter((question) => question.branch_id === selectedBranchId)
        .sort((a, b) => a.order_index - b.order_index),
    [questions, selectedBranchId],
  );

  const loadData = async () => {
    try {
      setError(null);
      const [formData, questionData, branchData] = await Promise.all([
        formsService.get(formId),
        questionsService.listByForm(formId),
        questionBranchesService.listByForm(formId),
      ]);
      setFormTitle(formData.title);
      setQuestions(questionData);
      setBranches(branchData);
      const trigger = questionData.find((question) => question.id === triggerQuestionId) ?? null;
      setTriggerQuestion(trigger);
      const nextBranch = branchId
        ? branchData.find((branch) => branch.id === branchId) ?? null
        : branchData.find((branch) => branch.trigger_question_id === triggerQuestionId) ?? null;
      setSelectedBranchId(nextBranch?.id ?? null);
      if (nextBranch) {
        setBranchTitle(nextBranch.title);
        setBranchDescription(nextBranch.description ?? '');
        setBranchTriggerOption(nextBranch.trigger_option_text);
      } else {
        const initialOption =
          trigger?.question_type === 'yes_no' && (trigger.options ?? []).length === 0
            ? 'Yes'
            : trigger?.options?.[0]?.option_text ?? '';
        setBranchTriggerOption(initialOption);
        const existing = branchData.find(
          (branch) =>
            branch.trigger_question_id === triggerQuestionId &&
            branch.trigger_option_text.trim().toLowerCase() === initialOption.trim().toLowerCase(),
        );
        setSelectedBranchId(existing?.id ?? null);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId, triggerQuestionId, branchId]);

  useEffect(() => {
    if (selectedBranch) {
      setBranchTitle(selectedBranch.title);
      setBranchDescription(selectedBranch.description ?? '');
      setBranchTriggerOption(selectedBranch.trigger_option_text);
      setEditingQuestionId(null);
    }
  }, [selectedBranch]);

  const resetQuestionBuilder = () => {
    setQuestionTitle('');
    setQuestionType('short_text');
    setQuestionPlaceholder('Short answer');
    setQuestionRequired(false);
    setQuestionOptions(['Option 1', 'Option 2']);
    setEditingQuestionId(null);
  };

  const addQuestionOption = () => {
    setQuestionOptions((current) => [...current, `Option ${current.length + 1}`]);
  };

  const removeQuestionOption = (index: number) => {
    setQuestionOptions((current) => {
      if (current.length <= 2) return current;
      return current.filter((_, idx) => idx !== index);
    });
  };

  const selectTriggerOption = (option: string) => {
    setBranchTriggerOption(option);
    const existing = branchByOption.get(option.trim().toLowerCase()) ?? null;
    setSelectedBranchId(existing?.id ?? null);
    if (existing) {
      setBranchTitle(existing.title);
      setBranchDescription(existing.description ?? '');
    } else {
      setBranchTitle('');
      setBranchDescription('');
      setEditingQuestionId(null);
      resetQuestionBuilder();
    }
  };

  const createBranch = async () => {
    if (!triggerQuestion) {
      setError('Trigger question not found.');
      return;
    }
    if (!branchTitle.trim()) {
      setError('Branch title is required.');
      return;
    }
    if (!branchTriggerOption.trim()) {
      setError('Choose a trigger option.');
      return;
    }
    const existing = branchByOption.get(branchTriggerOption.trim().toLowerCase()) ?? null;
    if (existing) {
      setSelectedBranchId(existing.id);
      setBranchTitle(existing.title);
      setBranchDescription(existing.description ?? '');
      return;
    }
    try {
      setSaving(true);
      const created = await questionBranchesService.create({
        form_id: formId,
        trigger_question_id: triggerQuestionId,
        trigger_option_text: branchTriggerOption.trim(),
        title: branchTitle.trim(),
        description: branchDescription.trim() || null,
        order_index: branchesForTrigger.length,
      });
      setBranches((current) => [...current, created]);
      setSelectedBranchId(created.id);
      setBranchTitle(created.title);
      setBranchDescription(created.description ?? '');
      setBranchTriggerOption(created.trigger_option_text);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveBranch = async () => {
    if (!selectedBranch) return;
    try {
      setSaving(true);
      const updated = await questionBranchesService.update(selectedBranch.id, {
        title: branchTitle.trim(),
        description: branchDescription.trim() || null,
        trigger_option_text: branchTriggerOption.trim(),
      });
      setBranches((current) => current.map((branch) => (branch.id === updated.id ? updated : branch)));
      setSelectedBranchId(updated.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteBranch = async () => {
    if (!selectedBranch) return;
    try {
      setSaving(true);
      await questionBranchesService.delete(selectedBranch.id);
      setBranches((current) => current.filter((branch) => branch.id !== selectedBranch.id));
      setSelectedBranchId(null);
      resetQuestionBuilder();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveQuestion = async () => {
    if (!selectedBranch) {
      setError('Create or select a branch first.');
      return;
    }
    if (!questionTitle.trim()) {
      setError('Question title is required.');
      return;
    }
    const payload = {
      form_id: formId,
      branch_id: selectedBranch.id,
      title: questionTitle.trim(),
      question_type: questionType,
      placeholder: questionPlaceholder.trim() || null,
      required: questionRequired,
      order_index: branchQuestions.length,
      options: ['radio', 'checkbox', 'dropdown'].includes(questionType)
        ? questionOptions.map((option, index) => ({ option_text: option.trim(), order_index: index })).filter((item) => item.option_text.length > 0)
        : [],
    };

    try {
      setSaving(true);
      if (editingQuestionId) {
        const updated = await questionsService.update(editingQuestionId, {
          title: payload.title,
          question_type: payload.question_type,
          placeholder: payload.placeholder,
          required: payload.required,
          order_index: branchQuestions.findIndex((question) => question.id === editingQuestionId),
          branch_id: selectedBranch.id,
          options: payload.options,
        });
        setQuestions((current) => current.map((question) => (question.id === updated.id ? updated : question)));
      } else {
        const created = await questionsService.create(payload);
        setQuestions((current) => [...current, created]);
      }
      resetQuestionBuilder();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const editQuestion = (question: QuestionItem) => {
    setEditingQuestionId(question.id);
    setQuestionTitle(question.title);
    setQuestionType(question.question_type);
    setQuestionPlaceholder(question.placeholder || 'Short answer');
    setQuestionRequired(question.required);
    setQuestionOptions(question.options.length ? question.options.map((option) => option.option_text) : ['Option 1', 'Option 2']);
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('FormDetail', { formId });
  };

  const deleteQuestion = async (questionId: string) => {
    try {
      setSaving(true);
      await questionsService.delete(questionId);
      setQuestions((current) => current.filter((question) => question.id !== questionId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={local.blue} />
      </View>
    );
  }

  if (!triggerQuestion) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Branch not found.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.backgroundLayer} pointerEvents="none">
        <View style={styles.bgGlowOne} />
        <View style={styles.bgGlowTwo} />
        <View style={styles.bgGlowThree} />
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.internalHeader}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.86}>
            <Feather name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.internalHeaderCopy}>
            <Text style={styles.pageEyebrow}>Branch workspace</Text>
            <Text style={styles.pageTitle}>{selectedBranch?.title || triggerQuestion.title}</Text>
          </View>
          <View style={styles.headerPill}>
            <Feather name="git-branch" size={14} color="#FFFFFF" />
            <Text style={styles.headerPillText}>Branch</Text>
          </View>
        </View>

        <View style={styles.pageHeader}>
          <Text style={styles.pageSubtitle}>Parent question: {triggerQuestion.title}</Text>
          <Text style={styles.pageSubtitleSecondary}>Same public URL, different branch path.</Text>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <LinearGradient colors={['rgba(8,17,45,0.02)', 'rgba(18,43,111,0.02)', 'rgba(109,40,217,0.02)']} style={styles.hero}>
          <Text style={styles.eyebrow}>Branch flow</Text>
          <Text style={styles.title}>{selectedBranch?.title || triggerQuestion.title}</Text>
          {selectedBranch?.description ? <Text style={styles.subtitle}>{selectedBranch.description}</Text> : null}
          <Text style={styles.helper}>Create and manage branching paths with the same calm visual language used in the form workspace.</Text>
        </LinearGradient>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Trigger option</Text>
        <View style={styles.chipWrap}>
          {triggerOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.chip, branchTriggerOption === option ? styles.chipActive : null]}
              onPress={() => selectTriggerOption(option)}
            >
              <Text style={[styles.chipText, branchTriggerOption === option ? styles.chipTextActive : null]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedBranch ? (
          <>
            <Text style={styles.sectionLabel}>Edit branch</Text>
            <TextInput value={branchTitle} onChangeText={setBranchTitle} placeholder="Branch title" placeholderTextColor="#5EA0FF" style={styles.input} />
            <TextInput value={branchDescription} onChangeText={setBranchDescription} placeholder="Branch description" placeholderTextColor="#5EA0FF" style={styles.input} />
            <TouchableOpacity style={styles.primaryButton} onPress={saveBranch} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save branch'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, styles.dangerButton]} onPress={deleteBranch} disabled={saving}>
              <Text style={[styles.secondaryButtonText, styles.dangerText]}>Delete branch</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Create branch</Text>
            <Text style={styles.helper}>Create the branch for "{branchTriggerOption || 'an option'}".</Text>
            <TextInput value={branchTitle} onChangeText={setBranchTitle} placeholder="Branch title" placeholderTextColor="#5EA0FF" style={styles.input} />
            <TextInput value={branchDescription} onChangeText={setBranchDescription} placeholder="Branch description" placeholderTextColor="#5EA0FF" style={styles.input} />
            <TouchableOpacity style={styles.primaryButton} onPress={createBranch} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Creating...' : `Create branch for "${branchTriggerOption || 'option'}"`}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Branches</Text>
          <Text style={styles.sectionNote}>{branchesForTrigger.length} total</Text>
        </View>
        {branchesForTrigger.length === 0 ? (
          <Text style={styles.emptyText}>No branches yet for this trigger question.</Text>
        ) : (
          branchesForTrigger.map((branch) => (
            <TouchableOpacity
              key={branch.id}
              style={[styles.branchRow, selectedBranchId === branch.id ? styles.branchRowActive : null]}
              onPress={() => {
                setSelectedBranchId(branch.id);
                setBranchTriggerOption(branch.trigger_option_text);
              }}
            >
              <View style={styles.branchCopy}>
                <Text style={styles.branchTitle}>{branch.title}</Text>
                <Text style={styles.branchMeta}>If answer is "{branch.trigger_option_text}"</Text>
                {branch.description ? <Text style={styles.branchMeta}>{branch.description}</Text> : null}
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{selectedBranch ? `Questions in ${selectedBranch.title}` : 'Choose a branch to add questions'}</Text>
        <Text style={styles.helper}>{selectedBranch ? 'These questions belong only to the selected option path.' : 'Pick a trigger option and branch to continue.'}</Text>
        <TextInput value={questionTitle} onChangeText={setQuestionTitle} placeholder="Question title" placeholderTextColor="#5EA0FF" style={styles.input} />
        <TextInput value={questionPlaceholder} onChangeText={setQuestionPlaceholder} placeholder="Placeholder" placeholderTextColor="#5EA0FF" style={styles.input} />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Required</Text>
          <Switch value={questionRequired} onValueChange={setQuestionRequired} trackColor={{ false: '#D8DBEA', true: local.blue }} thumbColor="#FFFFFF" />
        </View>

        <Text style={styles.sectionLabel}>Question type</Text>
        <View style={styles.chipWrap}>
          {questionTypes.map((type) => (
            <TouchableOpacity key={type.value} style={[styles.chip, questionType === type.value ? styles.chipActive : null]} onPress={() => setQuestionType(type.value)}>
              <Text style={[styles.chipText, questionType === type.value ? styles.chipTextActive : null]}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {['radio', 'checkbox', 'dropdown'].includes(questionType) ? (
          <View>
            {questionOptions.map((option, index) => (
              <View key={`${index}-${option}`} style={styles.optionRow}>
                <TextInput
                  value={option}
                  onChangeText={(text) => {
                    const next = [...questionOptions];
                    next[index] = text;
                    setQuestionOptions(next);
                  }}
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor="#5EA0FF"
                  style={[styles.input, styles.optionInput]}
                />
                <TouchableOpacity
                  style={[styles.optionButton, questionOptions.length <= 2 ? styles.optionButtonDisabled : null]}
                  disabled={questionOptions.length <= 2}
                  onPress={() => removeQuestionOption(index)}
                >
                  <Text style={[styles.optionButtonText, questionOptions.length <= 2 ? styles.optionButtonTextDisabled : null]}>Del</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addOptionButton} onPress={addQuestionOption}>
              <Text style={styles.addOptionText}>+ Add option</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity style={styles.primaryButton} onPress={saveQuestion} disabled={saving || !selectedBranch}>
          <Text style={styles.primaryButtonText}>{editingQuestionId ? 'Save question' : selectedBranch ? 'Add question' : 'Select a branch first'}</Text>
        </TouchableOpacity>

        <View style={styles.questionList}>
          {branchQuestions.length === 0 ? (
            <Text style={styles.emptyText}>No questions added to this branch yet.</Text>
          ) : (
            branchQuestions.map((question, index) => (
              <View key={question.id} style={styles.questionRow}>
                <View style={styles.indexBadge}><Text style={styles.indexText}>{index + 1}</Text></View>
                <View style={styles.questionCopy}>
                  <Text style={styles.questionTitle}>{question.title}</Text>
                  <Text style={styles.questionMeta}>{question.question_type}{question.required ? ' · required' : ' · optional'}</Text>
                </View>
                <TouchableOpacity style={styles.smallButton} onPress={() => editQuestion(question)}><Text style={styles.smallButtonText}>Edit</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.smallButton, styles.smallButtonDanger]} onPress={() => deleteQuestion(question.id)}><Text style={[styles.smallButtonText, styles.smallButtonTextDanger]}>Delete</Text></TouchableOpacity>
                <TouchableOpacity style={styles.smallButton} onPress={() => navigation.navigate('FormConditions', { formId, questionId: question.id })}><Text style={styles.smallButtonText}>Conditions</Text></TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F5FF', position: 'relative' },
  backgroundLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgGlowOne: { position: 'absolute', top: -70, left: -90, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(91, 75, 255, 0.16)' },
  bgGlowTwo: { position: 'absolute', top: 140, right: -110, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(46, 166, 255, 0.14)' },
  bgGlowThree: { position: 'absolute', bottom: -120, left: '16%', width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(168, 111, 255, 0.10)' },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, paddingBottom: 40, alignItems: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F5FF', padding: 24 },
  internalHeader: { width: '100%', maxWidth: 980, flexDirection: 'row', alignItems: 'center', marginBottom: 14, padding: 14, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.76)', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', shadowColor: 'rgba(91, 75, 255, 0.10)', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 10, zIndex: 2 },
  internalHeaderCopy: { flex: 1, paddingHorizontal: 14 },
  backButton: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(91, 75, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.12)' },
  pageEyebrow: { color: local.blue, fontWeight: '700', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  pageTitle: { color: local.ink, fontSize: 28, fontWeight: '900', lineHeight: 34 },
  headerPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: 'rgba(91, 75, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.12)', paddingHorizontal: 12, paddingVertical: 8 },
  headerPillText: { marginLeft: 6, color: local.blue, fontSize: 12, fontWeight: '900' },
  pageHeader: { width: '100%', maxWidth: 980, backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 28, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)' },
  pageSubtitle: { color: local.ink, lineHeight: 20, textAlign: 'center', fontWeight: '700' },
  pageSubtitleSecondary: { color: local.muted, lineHeight: 20, textAlign: 'center', marginTop: 4 },
  hero: { width: '100%', maxWidth: 980, borderRadius: 24, padding: 18, marginBottom: 14, backgroundColor: '#FBF7FF', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', shadowColor: 'rgba(15, 23, 42, 0.08)', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 3 },
  eyebrow: { color: local.blue, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
  title: { color: local.ink, fontSize: 28, fontWeight: '900', marginTop: 0, lineHeight: 34 },
  subtitle: { color: local.muted, marginTop: 8, lineHeight: 20, fontWeight: '600' },
  helper: { color: local.muted, marginTop: 10, lineHeight: 20, fontWeight: '600' },
  card: { width: '100%', maxWidth: 980, backgroundColor: '#FBF7FF', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', padding: 18, marginBottom: 14, shadowColor: 'rgba(15, 23, 42, 0.06)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  sectionLabel: { color: local.blue, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.3, marginBottom: 8 },
  sectionTitle: { color: local.ink, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  sectionNote: { color: local.muted, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: local.line, backgroundColor: local.soft, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  chipActive: { backgroundColor: 'rgba(91, 75, 255, 0.12)', borderColor: local.blue },
  chipText: { color: local.ink, fontSize: 12, fontWeight: '800' },
  chipTextActive: { color: local.blue },
  input: { minHeight: 48, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', backgroundColor: local.soft, borderRadius: 14, paddingHorizontal: 14, color: local.ink, marginBottom: 10, ...webInputReset },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionInput: { flex: 1 },
  optionButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#FFF2F4', borderWidth: 1, borderColor: '#F5C3CB', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  optionButtonDisabled: { opacity: 0.4 },
  optionButtonText: { color: local.red, fontWeight: '900' },
  optionButtonTextDisabled: { color: '#9CA3AF' },
  addOptionButton: { minHeight: 46, borderRadius: 14, backgroundColor: local.soft, borderWidth: 1, borderColor: local.line, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  addOptionText: { color: local.blue, fontWeight: '900' },
  primaryButton: { minHeight: 48, borderRadius: 14, backgroundColor: local.blue, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 14, backgroundColor: local.soft, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderWidth: 1, borderColor: local.line },
  secondaryButtonText: { color: local.ink, fontWeight: '900' },
  dangerButton: { backgroundColor: '#FFF2F4', borderColor: '#F5C3CB' },
  dangerText: { color: local.red },
  branchRow: { backgroundColor: local.soft, borderRadius: 14, borderWidth: 1, borderColor: local.line, padding: 14, marginBottom: 10 },
  branchRowActive: { borderColor: local.blue, backgroundColor: 'rgba(91, 75, 255, 0.06)' },
  branchCopy: { flex: 1 },
  branchTitle: { color: local.ink, fontWeight: '900', marginBottom: 3 },
  branchMeta: { color: local.muted, fontSize: 12, lineHeight: 18 },
  questionList: { marginTop: 12 },
  questionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: local.line },
  indexBadge: { width: 30, height: 30, borderRadius: 8, backgroundColor: local.soft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  indexText: { color: local.blue, fontWeight: '900' },
  questionCopy: { flex: 1, marginRight: 10 },
  questionTitle: { color: local.ink, fontWeight: '900' },
  questionMeta: { color: local.muted, fontSize: 12, marginTop: 3 },
  smallButton: { borderRadius: 10, borderWidth: 1, borderColor: local.line, backgroundColor: local.soft, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 8 },
  smallButtonDanger: { backgroundColor: '#FFF2F4', borderColor: '#F5C3CB' },
  smallButtonText: { color: local.ink, fontWeight: '800', fontSize: 12 },
  smallButtonTextDanger: { color: local.red },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  switchLabel: { color: local.ink, fontWeight: '800' },
  emptyText: { color: local.muted, lineHeight: 20 },
  errorBox: { width: '100%', maxWidth: 980, backgroundColor: '#FFF0F3', borderRadius: 16, borderWidth: 1, borderColor: '#F4C7D0', padding: 12, marginBottom: 12 },
  errorText: { color: local.red, fontWeight: '800' },
});
