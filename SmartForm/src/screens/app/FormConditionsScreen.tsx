import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/NavigationTypes';
import { formsService } from '../../api/forms-service';
import { questionsService, QuestionItem, QuestionType } from '../../api/questions-service';
import { conditionalRulesService, ConditionalRuleItem } from '../../api/conditional-rules-service';
import { getErrorMessage } from '../../api/client';
import { CONDITIONAL_OPERATORS, shouldRuleUseValue, evaluateConditionalOperator, type ConditionalRuleOperator } from '../../utils';
import { questionTypes } from './FormDetailScreen';
import { webInputReset } from '../../utils/webInputReset';

const local = {
  ink: '#172033',
  muted: '#6b7280',
  line: '#e7ebf6',
  soft: '#f7f8fc',
  blue: '#5b4bff',
  amber: '#f59e0b',
  green: '#34c759',
  red: '#ef4444',
};

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const FormConditionsScreen: React.FC<NativeStackScreenProps<AppStackParamList, 'FormConditions'>> = ({ route, navigation }) => {
  const { formId, questionId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [rules, setRules] = useState<ConditionalRuleItem[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionItem | null>(null);
  const [questionTitle, setQuestionTitle] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('short_text');
  const [questionPlaceholder, setQuestionPlaceholder] = useState('Short answer');
  const [questionRequired, setQuestionRequired] = useState(false);
  const [questionOptions, setQuestionOptions] = useState<string[]>(['Option 1', 'Option 2']);
  const [ruleOperator, setRuleOperator] = useState<ConditionalRuleOperator>('equals');
  const [ruleValue, setRuleValue] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const choiceOptions = useMemo(() => {
    if (!selectedQuestion) return [];
    if (selectedQuestion.question_type === 'yes_no' && selectedQuestion.options.length === 0) {
      return ['Yes', 'No'];
    }
    return selectedQuestion.options.map((option) => option.option_text);
  }, [selectedQuestion]);

  const followupNeedsValue = shouldRuleUseValue(ruleOperator);

  const comparisonValue = useMemo(() => {
    if (selectedQuestion && ['radio', 'checkbox', 'dropdown', 'yes_no'].includes(selectedQuestion.question_type)) {
      return selectedOption.trim();
    }
    return ruleValue.trim();
  }, [ruleValue, selectedOption, selectedQuestion]);

  const matchingRules = useMemo(() => {
    if (!selectedQuestion) return [];
    return rules.filter((rule) => {
      if (rule.trigger_field_id !== selectedQuestion.id) return false;
      if (rule.trigger_operator !== ruleOperator) return false;
      if (!followupNeedsValue) return true;
      return (rule.trigger_value ?? '').trim().toLowerCase() === comparisonValue.toLowerCase();
    });
  }, [comparisonValue, followupNeedsValue, ruleOperator, rules, selectedQuestion]);

  const matchingChildren = useMemo(
    () =>
      matchingRules
        .map((rule) => questions.find((question) => question.id === rule.target_field_id))
        .filter(Boolean) as QuestionItem[],
    [matchingRules, questions],
  );

  const loadData = async () => {
    try {
      setError(null);
      const [formData, questionData, ruleData] = await Promise.all([
        formsService.get(formId),
        questionsService.listByForm(formId),
        conditionalRulesService.listByForm(formId),
      ]);
      setFormTitle(formData.title);
      setQuestions(questionData);
      setRules(ruleData.items);
      const question = questionData.find((item) => item.id === questionId) ?? null;
      setSelectedQuestion(question);
      if (question) {
        setRuleOperator('equals');
        setSelectedOption((question.options[0]?.option_text ?? (question.question_type === 'yes_no' ? 'Yes' : '')).toString());
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
  }, [formId, questionId]);

  const resetBuilder = () => {
    setQuestionTitle('');
    setQuestionType('short_text');
    setQuestionPlaceholder('Short answer');
    setQuestionRequired(false);
    setQuestionOptions(['Option 1', 'Option 2']);
    setEditingQuestionId(null);
  };

  const saveFollowup = async () => {
    if (!selectedQuestion) return;
    if (!questionTitle.trim()) {
      setError('Question title is required.');
      return;
    }
    if (followupNeedsValue && !comparisonValue) {
      setError('Choose a comparison value first.');
      return;
    }

    const payload = {
      form_id: formId,
      title: questionTitle.trim(),
      question_type: questionType,
      placeholder: questionPlaceholder.trim() || null,
      required: questionRequired,
      order_index: questions.length,
      options: ['radio', 'checkbox', 'dropdown'].includes(questionType)
        ? questionOptions
            .map((option, index) => ({ option_text: option.trim(), order_index: index }))
            .filter((option) => option.option_text.length > 0)
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
          order_index: questions.findIndex((item) => item.id === editingQuestionId),
          options: payload.options,
        });
        setQuestions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const createdQuestion = await questionsService.create(payload);
        setQuestions((current) => [...current, createdQuestion]);
        await conditionalRulesService.create({
          form_id: formId,
          trigger_field_id: selectedQuestion.id,
          trigger_operator: ruleOperator,
          trigger_value: followupNeedsValue ? comparisonValue : null,
          target_field_id: createdQuestion.id,
          target_action: 'show',
        });
      }
      resetBuilder();
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteChild = async (childId: string) => {
    try {
      setSaving(true);
      const childRules = rules.filter((rule) => rule.target_field_id === childId);
      await Promise.all(childRules.map((rule) => conditionalRulesService.delete(rule.id)));
      await questionsService.delete(childId);
      setQuestions((current) => current.filter((item) => item.id !== childId));
      setRules((current) => current.filter((rule) => rule.target_field_id !== childId));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const editChild = (child: QuestionItem) => {
    setEditingQuestionId(child.id);
    setQuestionTitle(child.title);
    setQuestionType(child.question_type);
    setQuestionPlaceholder(child.placeholder || 'Short answer');
    setQuestionRequired(child.required);
    setQuestionOptions(child.options.length ? child.options.map((option) => option.option_text) : ['Option 1', 'Option 2']);
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('FormDetail', { formId });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={local.blue} />
      </View>
    );
  }

  if (!selectedQuestion) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error || 'Question not found.'}</Text>
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
            <Text style={styles.pageEyebrow}>Conditional logic</Text>
            <Text style={styles.pageTitle}>{selectedQuestion.title}</Text>
          </View>
          <View style={styles.headerPill}>
            <Feather name="git-branch" size={14} color="#FFFFFF" />
            <Text style={styles.headerPillText}>Rules</Text>
          </View>
        </View>

        <View style={styles.pageHeader}>
          <Text style={styles.pageSubtitle}>{formTitle}</Text>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <LinearGradient colors={['rgba(8,17,45,0.02)', 'rgba(18,43,111,0.02)', 'rgba(109,40,217,0.02)']} style={styles.hero}>
          <Text style={styles.eyebrow}>Conditional workspace</Text>
          <Text style={styles.title}>{selectedQuestion.title}</Text>
          <Text style={styles.subtitle}>{formTitle}</Text>
          <Text style={styles.helper}>Build the answer path, preview the rule, and keep the follow-up flow easy to read.</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>When answer</Text>
          <View style={styles.chipWrap}>
            {CONDITIONAL_OPERATORS.map((operator) => (
            <TouchableOpacity
              key={operator.value}
              style={[styles.chip, ruleOperator === operator.value ? styles.chipActive : null]}
              onPress={() => setRuleOperator(operator.value)}
            >
              <Text style={[styles.chipText, ruleOperator === operator.value ? styles.chipTextActive : null]}>{operator.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Compare with</Text>
        {choiceOptions.length > 0 ? (
          <View style={styles.chipWrap}>
            {choiceOptions.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.chip, selectedOption === option ? styles.chipActive : null]}
                onPress={() => setSelectedOption(option)}
              >
                <Text style={[styles.chipText, selectedOption === option ? styles.chipTextActive : null]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TextInput
            value={ruleValue}
            onChangeText={setRuleValue}
            placeholder="Enter comparison value"
            placeholderTextColor="#5EA0FF"
            style={styles.input}
          />
        )}

        <View style={styles.previewCard}>
          <Text style={styles.previewLabel}>Rule preview</Text>
          <Text style={styles.previewText}>
            If {selectedQuestion.title} {operatorLabel(ruleOperator)} {comparisonValue ? `"${comparisonValue}"` : '...'}, show follow-up questions.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Follow-up questions</Text>
          <Text style={styles.sectionNote}>{matchingChildren.length} linked question{matchingChildren.length === 1 ? '' : 's'}</Text>
        </View>
        {matchingChildren.length === 0 ? (
          <Text style={styles.emptyText}>No follow-up questions yet for this answer.</Text>
        ) : (
          matchingChildren.map((child, index) => (
            <View key={child.id} style={styles.childRow}>
              <View style={styles.childIndex}><Text style={styles.childIndexText}>{index + 1}</Text></View>
              <View style={styles.childCopy}>
                <Text style={styles.childTitle}>{child.title}</Text>
                <Text style={styles.childMeta}>{child.question_type}{child.required ? ' · required' : ' · optional'}</Text>
              </View>
              <TouchableOpacity onPress={() => editChild(child)} style={styles.smallButton}><Text style={styles.smallButtonText}>Edit</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => deleteChild(child.id)} style={[styles.smallButton, styles.smallButtonDanger]}><Text style={[styles.smallButtonText, styles.smallButtonTextDanger]}>Delete</Text></TouchableOpacity>
            </View>
          ))
        )}
      </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{editingQuestionId ? 'Edit follow-up question' : 'Add follow-up question'}</Text>
        <TextInput value={questionTitle} onChangeText={setQuestionTitle} placeholder="Question title" placeholderTextColor="#5EA0FF" style={styles.input} />
        <TextInput value={questionPlaceholder} onChangeText={setQuestionPlaceholder} placeholder="Placeholder" placeholderTextColor="#5EA0FF" style={styles.input} />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Required</Text>
          <Switch value={questionRequired} onValueChange={setQuestionRequired} trackColor={{ false: '#D8DBEA', true: local.blue }} thumbColor="#FFFFFF" />
        </View>

        <Text style={styles.sectionLabel}>Question type</Text>
        <View style={styles.typeGrid}>
          {questionTypes.map((type) => (
            <TouchableOpacity key={type.value} style={[styles.typeChip, questionType === type.value ? styles.typeChipActive : null]} onPress={() => setQuestionType(type.value)}>
              <Text style={[styles.typeChipText, questionType === type.value ? styles.typeChipTextActive : null]}>{type.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {['radio', 'checkbox', 'dropdown'].includes(questionType) ? (
          <View style={styles.optionBox}>
            {questionOptions.map((option, index) => (
              <TextInput
                key={`${option}-${index}`}
                value={option}
                onChangeText={(text) => {
                  const next = [...questionOptions];
                  next[index] = text;
                  setQuestionOptions(next);
                }}
                style={styles.input}
                placeholder={`Option ${index + 1}`}
                placeholderTextColor="#5EA0FF"
              />
            ))}
          </View>
        ) : null}

        <TouchableOpacity onPress={saveFollowup} style={styles.primaryButton} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : 'Save follow-up question'}</Text>
        </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const operatorLabel = (operator: string) => CONDITIONAL_OPERATORS.find((item) => item.value === operator)?.label.toLowerCase() ?? operator.replace(/_/g, ' ');

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
  pageSubtitle: { color: local.muted, lineHeight: 20, textAlign: 'center', maxWidth: 720 },
  hero: { width: '100%', maxWidth: 980, borderRadius: 24, padding: 18, marginBottom: 14, backgroundColor: '#FBF7FF', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', shadowColor: 'rgba(15, 23, 42, 0.08)', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 3 },
  eyebrow: { color: local.blue, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4, marginBottom: 6 },
  title: { color: local.ink, fontSize: 28, fontWeight: '900', marginTop: 0, lineHeight: 34 },
  subtitle: { color: local.muted, marginTop: 8, lineHeight: 20, fontWeight: '600' },
  helper: { color: local.muted, marginTop: 8, lineHeight: 20, fontWeight: '600' },
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
  previewCard: { backgroundColor: '#F8F7FF', borderRadius: 16, borderWidth: 1, borderColor: local.line, padding: 14, marginTop: 8 },
  previewLabel: { color: local.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 6 },
  previewText: { color: local.ink, fontWeight: '800', lineHeight: 21 },
  emptyText: { color: local.muted, lineHeight: 20 },
  childRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: local.line },
  childIndex: { width: 30, height: 30, borderRadius: 8, backgroundColor: local.soft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  childIndexText: { color: local.blue, fontWeight: '900' },
  childCopy: { flex: 1, marginRight: 10 },
  childTitle: { color: local.ink, fontWeight: '900' },
  childMeta: { color: local.muted, fontSize: 12, marginTop: 3 },
  smallButton: { borderRadius: 10, borderWidth: 1, borderColor: local.line, backgroundColor: local.soft, paddingHorizontal: 12, paddingVertical: 8, marginLeft: 8 },
  smallButtonDanger: { backgroundColor: '#FFF2F4', borderColor: '#F5C3CB' },
  smallButtonText: { color: local.ink, fontWeight: '800', fontSize: 12 },
  smallButtonTextDanger: { color: local.red },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 },
  switchLabel: { color: local.ink, fontWeight: '800' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  typeChip: { borderRadius: 999, borderWidth: 1, borderColor: local.line, backgroundColor: local.soft, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  typeChipActive: { backgroundColor: local.blue, borderColor: local.blue },
  typeChipText: { color: local.ink, fontSize: 12, fontWeight: '800' },
  typeChipTextActive: { color: '#FFFFFF' },
  optionBox: { marginBottom: 8 },
  primaryButton: { minHeight: 48, borderRadius: 14, backgroundColor: local.blue, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  errorBox: { width: '100%', maxWidth: 980, backgroundColor: '#FFF0F3', borderRadius: 16, borderWidth: 1, borderColor: '#F4C7D0', padding: 12, marginBottom: 12 },
  errorText: { color: local.red, fontWeight: '800' },
});
