import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formsService, FormItem, FormVersionItem } from '../../api/forms-service';
import { ResponseItem } from '../../api/responses-service';
import { getErrorMessage } from '../../api/client';
import { AppStackParamList } from '../../navigation/NavigationTypes';

const local = {
  ink: '#171429',
  muted: '#716C87',
  line: '#DED9FB',
  soft: '#F1F0FF',
  blue: '#7657F7',
  green: '#159A8A',
  amber: '#D88B20',
  red: '#D9576B',
};

type VersionQuestion = {
  id: string;
  title: string;
  type: string;
  placeholder?: string | null;
  required?: boolean;
  order_index?: number;
  options: Array<{ id?: string; text: string; order?: number }>;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
};

const readString = (value: unknown, fallback = '') => {
  return typeof value === 'string' ? value : fallback;
};

const readNumber = (value: unknown) => {
  return typeof value === 'number' ? value : undefined;
};

const readBoolean = (value: unknown) => {
  return typeof value === 'boolean' ? value : undefined;
};

const getVersionQuestions = (version?: FormVersionItem): VersionQuestion[] => {
  const snapshot = asRecord(version?.schema_snapshot);
  const rawQuestions = Array.isArray(snapshot.questions) ? snapshot.questions : [];

  return rawQuestions.map((rawQuestion, index) => {
    const question = asRecord(rawQuestion);
    const rawOptions = Array.isArray(question.options) ? question.options : [];

    return {
      id: readString(question.id, `question-${index + 1}`),
      title: readString(question.title, `Question ${index + 1}`),
      type: readString(question.type, 'unknown'),
      placeholder: readString(question.placeholder, ''),
      required: readBoolean(question.required),
      order_index: readNumber(question.order_index) ?? index,
      options: rawOptions.map((rawOption, optionIndex) => {
        const option = asRecord(rawOption);
        return {
          id: typeof option.id === 'string' ? option.id : undefined,
          text: readString(option.text, `Option ${optionIndex + 1}`),
          order: readNumber(option.order) ?? optionIndex,
        };
      }),
    };
  }).sort((left, right) => (left.order_index ?? 0) - (right.order_index ?? 0));
};

const shortId = (id?: string | null) => id ? id.slice(0, 8) : 'deleted';

const formatAnswer = (answer: string | null, filePath?: string | null) => {
  if (answer && answer.trim()) return answer;
  if (filePath) return '[file uploaded]';
  return 'No answer';
};

export const FormVersionDetailScreen: React.FC<NativeStackScreenProps<AppStackParamList, 'FormVersionDetail'>> = ({ route, navigation }) => {
  const { formId, versionNumber } = route.params;
  const [form, setForm] = useState<FormItem | null>(null);
  const [version, setVersion] = useState<FormVersionItem | null>(null);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [responseTotal, setResponseTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questions = useMemo(() => getVersionQuestions(version ?? undefined), [version]);
  const questionsById = useMemo(() => new Map(questions.map((question) => [question.id, question])), [questions]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [formData, versionsData, responseData] = await Promise.all([
        formsService.get(formId),
        formsService.listVersions(formId),
        formsService.listVersionResponses(formId, versionNumber),
      ]);
      const selectedVersion = versionsData.items.find((item) => item.version_number === versionNumber) ?? null;
      setForm(formData);
      setVersion(selectedVersion);
      setResponses(responseData.items);
      setResponseTotal(responseData.total);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [formId, versionNumber]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refresh = () => {
    setRefreshing(true);
    loadData();
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[local.blue]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.internalHeader}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.86}>
            <Feather name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.internalHeaderCopy}>
            <Text style={styles.pageEyebrow}>Version detail</Text>
            <Text style={styles.pageTitle}>{form?.title ?? 'Form version'}</Text>
          </View>
          <View style={styles.headerPill}>
            <Feather name="file-text" size={14} color="#FFFFFF" />
            <Text style={styles.headerPillText}>v{versionNumber}</Text>
          </View>
        </View>

        <View style={styles.pageHeader}>
          <Text style={styles.pageSubtitle}>
            {version ? new Date(version.created_at).toLocaleString() : 'Version snapshot unavailable'}
          </Text>
        </View>

        {loading ? <ActivityIndicator style={styles.loader} size="large" color={local.blue} /> : null}
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.statsGrid}>
          <StatBox label="Questions" value={questions.length.toString()} />
          <StatBox label="Responses" value={responseTotal.toString()} />
          <StatBox label="Status" value={version?.is_published ? 'Published' : 'Draft'} />
          <StatBox label="URL" value={form?.form_slug ?? '-'} />
        </View>

        <Panel title="Questions in this version">
          <ScrollView style={styles.innerScroll} contentContainerStyle={styles.innerScrollContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {questions.length === 0 ? (
              <Empty text="No saved questions found for this version." />
            ) : (
              questions.map((question, index) => <QuestionCard key={question.id} question={question} index={index} />)
            )}
          </ScrollView>
        </Panel>

        <Panel title="Responses for this version">
          <ScrollView style={styles.innerScroll} contentContainerStyle={styles.innerScrollContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {responses.length === 0 ? (
              <Empty text="No responses captured for this version." />
            ) : (
              responses.map((response, index) => (
                <ResponseCard
                  key={response.id}
                  response={response}
                  index={index}
                  questionsById={questionsById}
                />
              ))
            )}
          </ScrollView>
        </Panel>
      </ScrollView>
    </View>
  );
};

const Panel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.panel}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statBox}>
    <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const QuestionCard: React.FC<{ question: VersionQuestion; index: number }> = ({ question, index }) => (
  <View style={styles.questionCard}>
    <View style={styles.indexBadge}><Text style={styles.indexText}>{index + 1}</Text></View>
    <View style={styles.rowCopy}>
      <Text style={styles.rowTitle}>{question.title}</Text>
      <Text style={styles.rowMeta}>
        {question.type}{question.required ? ' · Required' : ' · Optional'}
      </Text>
      {question.placeholder ? <Text style={styles.placeholderText}>{question.placeholder}</Text> : null}
      {question.options.length > 0 ? (
        <View style={styles.optionList}>
          {question.options.map((option, optionIndex) => (
            <Text key={`${question.id}-${option.id ?? optionIndex}`} style={styles.optionText}>
              {optionIndex + 1}. {option.text}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  </View>
);

const ResponseCard: React.FC<{
  response: ResponseItem;
  index: number;
  questionsById: Map<string, VersionQuestion>;
}> = ({ response, index, questionsById }) => {
  const label = response.respondent_email || response.submitted_by || `Anonymous #${index + 1}`;

  return (
    <View style={styles.responseCard}>
      <View style={styles.responseTop}>
        <View style={styles.responseAvatar}><Text style={styles.responseAvatarText}>{label.charAt(0).toUpperCase()}</Text></View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{label}</Text>
          <Text style={styles.rowMeta}>
            {new Date(response.submitted_at).toLocaleString()} · {response.answers.length} answers
            {response.completion_time ? ` · ${Math.round(response.completion_time)}s` : ''}
          </Text>
          {response.device || response.browser ? <Text style={styles.rowMeta}>{[response.device, response.browser].filter(Boolean).join(' · ')}</Text> : null}
        </View>
      </View>

      <View style={styles.answerTable}>
        {response.answers.map((answer) => {
          const answerSnapshot = asRecord(answer.question_snapshot);
          const snapshotId = readString(answerSnapshot.id, '');
          const question = questionsById.get(answer.question_id ?? snapshotId);
          const questionTitle = question?.title || readString(answerSnapshot.title, shortId(answer.question_id));

          return (
            <View key={answer.id} style={styles.answerRow}>
              <Text style={styles.answerQuestion}>{questionTitle}</Text>
              <Text style={styles.answerValue}>{formatAnswer(answer.answer, answer.file_path)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <View style={styles.emptyState}><Text style={styles.emptyText}>{text}</Text></View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F5FF', position: 'relative' },
  backgroundLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgGlowOne: { position: 'absolute', top: -70, left: -90, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(91, 75, 255, 0.16)' },
  bgGlowTwo: { position: 'absolute', top: 140, right: -110, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(46, 166, 255, 0.14)' },
  bgGlowThree: { position: 'absolute', bottom: -120, left: '16%', width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(168, 111, 255, 0.10)' },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 16, paddingBottom: 30, alignItems: 'center' },
  loader: { marginVertical: 24 },
  errorBox: { width: '100%', maxWidth: 980, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', padding: 12, marginBottom: 12 },
  errorText: { color: local.red, fontWeight: '800' },
  internalHeader: { width: '100%', maxWidth: 980, flexDirection: 'row', alignItems: 'center', marginBottom: 14, padding: 14, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.76)', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', shadowColor: 'rgba(91, 75, 255, 0.10)', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 10 },
  internalHeaderCopy: { flex: 1, paddingHorizontal: 14 },
  headerPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: 'rgba(91, 75, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.12)', paddingHorizontal: 12, paddingVertical: 8 },
  headerPillText: { marginLeft: 6, color: local.blue, fontSize: 12, fontWeight: '900' },
  pageEyebrow: { color: '#5B4BFF', fontWeight: '700', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  pageTitle: { color: local.ink, fontSize: 26, fontWeight: '800', lineHeight: 34 },
  pageHeader: { width: '100%', maxWidth: 980, backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 28, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)' },
  pageSubtitle: { color: local.muted, lineHeight: 21 },
  backButton: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(91, 75, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.12)' },
  statsGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  statBox: { width: '48%', backgroundColor: '#FBF7FF', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', padding: 14, marginRight: 8, marginBottom: 10, shadowColor: 'rgba(15, 23, 42, 0.06)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  statValue: { color: local.ink, fontSize: 22, fontWeight: '900' },
  statLabel: { color: local.muted, fontSize: 12, fontWeight: '800', marginTop: 3 },
  panel: { width: '100%', maxWidth: 980, backgroundColor: '#FBF7FF', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', padding: 16, marginBottom: 14, shadowColor: 'rgba(15, 23, 42, 0.06)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  sectionTitle: { color: local.ink, fontSize: 18, fontWeight: '900', marginBottom: 12 },
  innerScroll: { maxHeight: 420 },
  innerScrollContent: { paddingBottom: 6 },
  questionCard: { flexDirection: 'row', paddingVertical: 12, borderTopWidth: 1, borderTopColor: local.line },
  indexBadge: { width: 34, height: 34, borderRadius: 8, backgroundColor: local.soft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  indexText: { color: local.blue, fontWeight: '900' },
  rowCopy: { flex: 1, marginRight: 8 },
  rowTitle: { color: local.ink, fontWeight: '900' },
  rowMeta: { color: local.muted, fontSize: 12, marginTop: 3 },
  placeholderText: { color: local.muted, fontSize: 13, marginTop: 8 },
  optionList: { backgroundColor: '#F8F7FF', borderRadius: 12, borderWidth: 1, borderColor: local.line, padding: 10, marginTop: 10 },
  optionText: { color: local.ink, fontSize: 13, lineHeight: 22, fontWeight: '700' },
  responseCard: { borderTopWidth: 1, borderTopColor: local.line, paddingVertical: 14 },
  responseTop: { flexDirection: 'row', alignItems: 'center' },
  responseAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: local.soft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  responseAvatarText: { color: local.blue, fontWeight: '900' },
  answerTable: { marginTop: 12, backgroundColor: '#F8F7FF', borderRadius: 14, borderWidth: 1, borderColor: local.line, overflow: 'hidden' },
  answerRow: { padding: 12, borderBottomWidth: 1, borderBottomColor: local.line },
  answerQuestion: { color: local.muted, fontSize: 12, fontWeight: '900', marginBottom: 4 },
  answerValue: { color: local.ink, fontSize: 14, lineHeight: 20 },
  emptyState: { backgroundColor: local.soft, borderRadius: 14, padding: 14 },
  emptyText: { color: local.muted, lineHeight: 20 },
});
