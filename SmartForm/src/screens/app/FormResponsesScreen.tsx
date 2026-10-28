import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/NavigationTypes';
import { responsesService, ResponseItem } from '../../api/responses-service';
import { questionsService, QuestionItem, QuestionType } from '../../api/questions-service';
import { analyticsService, FormAnalytics } from '../../api/analytics-service';
import { getErrorMessage, httpClient } from '../../api/client';
import { exportService } from '../../api/export-service';
import { HorizontalBarChart, ResponsePieChart, TrendLineChart } from '../../components/TrendLineChart';
import { questionTypes } from './FormDetailScreen';
import { webInputReset } from '../../utils/webInputReset';

const local = {
  ink: '#172033',
  muted: '#6b7280',
  line: '#e7ebf6',
  soft: '#f7f8fc',
  blue: '#5b4bff',
  red: '#ef4444',
  green: '#159A8A',
};

const getQuestionTypeLabel = (type: QuestionType) => {
  const mapping = questionTypes.find((item) => item.value === type);
  return mapping ? mapping.label : 'Field';
};

const getQuestionTypeIcon = (type: QuestionType) => {
  const mapping = questionTypes.find((item) => item.value === type);
  return mapping ? mapping.icon : 'circle';
};

const EXPORT_META = {
  csv: {
    filename: (formId: string) => `${formId}_responses.csv`,
    mimeType: 'text/csv;charset=utf-8',
  },
  xlsx: {
    filename: (formId: string) => `${formId}_responses.xlsx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  docx: {
    filename: (formId: string) => `${formId}_analytics.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  analytics: {
    filename: (formId: string) => `${formId}_analytics.json`,
    mimeType: 'application/json;charset=utf-8',
  },
} as const;

const parseFilenameFromContentDisposition = (contentDisposition: string | undefined): string | null => {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*\=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const filenameMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
  return filenameMatch?.[1] ?? null;
};

export const FormResponsesScreen: React.FC<NativeStackScreenProps<AppStackParamList, 'FormResponses'>> = ({ route, navigation }) => {
  const { formId } = route.params;
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [formAnalytics, setFormAnalytics] = useState<FormAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const responseDetailsById = useMemo(() => {
    const entries = formAnalytics?.responses.map((response) => [response.id, response] as const) ?? [];
    return new Map(entries);
  }, [formAnalytics]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const [questionData, responseData, analyticsData] = await Promise.all([
        questionsService.listByForm(formId),
        responsesService.searchByForm(formId, { page: 1, page_size: 50, search: submittedSearch.trim() || undefined }),
        analyticsService.getForm(formId),
      ]);
      setQuestions(questionData);
      setResponses(responseData.items);
      setFormAnalytics(analyticsData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [formId, submittedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const completionRate = Math.max(0, Math.min(100, Math.round(formAnalytics?.completion_rate ?? 0)));
  const totalResponses = formAnalytics?.total_responses ?? responses.length;
  const averageCompletionTime = formAnalytics?.average_completion_time
    ? `${Math.round(formAnalytics.average_completion_time)}s`
    : '—';
  const trendRows = formAnalytics?.daily_responses ?? [];

  const overallCompletionRows = useMemo(() => {
    if (!formAnalytics) return [];
    const answered = formAnalytics.questions.reduce((sum, question) => sum + question.total_answers, 0);
    const skipped = formAnalytics.questions.reduce((sum, question) => sum + question.skipped, 0);
    if (answered + skipped === 0) return [];
    return [
      { label: 'Answered', value: answered },
      { label: 'Skipped', value: skipped },
    ];
  }, [formAnalytics]);

  const overallOptionRows = useMemo(() => {
    const counts = new Map<string, number>();
    (formAnalytics?.questions ?? []).forEach((question) => {
      question.options.forEach((option) => {
        counts.set(option.option, (counts.get(option.option) ?? 0) + option.count);
      });
    });
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [formAnalytics]);

  const questionAnswerVolumeRows = useMemo(
    () =>
      (formAnalytics?.questions ?? [])
        .map((question) => ({ label: question.title, value: question.total_answers }))
        .filter((item) => item.value > 0),
    [formAnalytics],
  );

  const downloadExport = async (kind: 'csv' | 'xlsx' | 'docx' | 'analytics') => {
    try {
      setExporting(kind);
      const urls = {
        csv: exportService.csvUrl(formId),
        xlsx: exportService.xlsxUrl(formId),
        docx: exportService.docxUrl(formId),
        analytics: exportService.analyticsUrl(formId),
      };

      const response = await httpClient.get(urls[kind], { responseType: 'arraybuffer' });
      const blob = new Blob([response.data], { type: EXPORT_META[kind].mimeType });

      if (typeof document === 'undefined' || typeof window === 'undefined') {
        throw new Error('File downloads are currently supported only in web builds.');
      }

      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const serverFilename = parseFilenameFromContentDisposition(response.headers?.['content-disposition']);
      anchor.href = objectUrl;
      anchor.download = serverFilename ?? EXPORT_META[kind].filename(formId);
      anchor.style.display = 'none';
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setExporting(null);
    }
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
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.86}>
            <Feather name="arrow-left" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.internalHeaderCopy}>
            <Text style={styles.pageEyebrow}>Form analytics</Text>
            <Text style={styles.pageTitle}>Questions, trends, and responses</Text>
          </View>
          <View style={styles.headerPill}>
            <Feather name="bar-chart-2" size={14} color="#FFFFFF" />
            <Text style={styles.headerPillText}>Responses</Text>
          </View>
        </View>

        <View style={styles.pageHeader}>
          <Text style={styles.pageSubtitle}>A cleaner view of how people answer, what they choose, and where the form is strong.</Text>
        </View>

        {loading ? <ActivityIndicator style={styles.loader} size="large" color={local.blue} /> : null}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!loading ? (
          <>
            <View style={styles.summaryRow}>
              <SummaryCard value={questions.length} label="Questions" tone="blue" />
              <SummaryCard value={responses.length} label="Responses" tone="green" />
              <SummaryCard value={totalResponses} label="Total responses" tone="amber" />
              <SummaryCard value={`${completionRate}%`} label="Completion" tone="red" />
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>Response pulse</Text>
                  <Text style={styles.sectionTitle}>At a glance</Text>
                  <Text style={styles.sectionDescription}>
                    Completion, response volume, and top-level distribution are grouped together for quick reading.
                  </Text>
                </View>
                <View style={styles.livePill}>
                  <Feather name="activity" size={12} color={local.blue} />
                  <Text style={styles.livePillText}>Live</Text>
                </View>
              </View>

              <View style={styles.heroMetrics}>
                <StatTile icon="bar-chart-2" label="Responses" value={String(totalResponses)} />
                <StatTile icon="check-circle" label="Completion" value={`${completionRate}%`} />
                <StatTile icon="clock" label="Avg time" value={averageCompletionTime} />
              </View>
            </View>

            <View style={styles.grid}>
              <View style={styles.chartCard}>
                <TrendLineChart
                  rows={trendRows}
                  height={220}
                  title="Response trend"
                  subtitle={trendRows.length > 0 ? 'Updated from recent submissions.' : 'No submission data yet.'}
                />
              </View>

              <View style={styles.chartCard}>
                <ResponsePieChart
                  title="Answered vs skipped"
                  rows={overallCompletionRows}
                  height={210}
                  subtitle="Shows how many answers were submitted versus skipped."
                />
              </View>
            </View>

            <View style={styles.grid}>
              <View style={styles.chartCard}>
                <HorizontalBarChart
                  title="Question answer volume"
                  rows={questionAnswerVolumeRows}
                  subtitle="Questions with the most answered submissions."
                  emptyLabel="No response volume is available yet."
                />
              </View>

              <View style={styles.chartCard}>
                <HorizontalBarChart
                  title="Top option distribution"
                  rows={overallOptionRows}
                  subtitle="Most selected options across the whole form."
                  emptyLabel="No option distribution data is available yet."
                />
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionEyebrow}>Export</Text>
                  <Text style={styles.sectionTitle}>Download response data</Text>
                </View>
                <View style={styles.exportRow}>
                  <TouchableOpacity style={styles.exportButton} onPress={() => downloadExport('csv')} disabled={Boolean(exporting)}>
                    <Text style={styles.exportButtonText}>{exporting === 'csv' ? 'Preparing…' : 'CSV'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.exportButton} onPress={() => downloadExport('xlsx')} disabled={Boolean(exporting)}>
                    <Text style={styles.exportButtonText}>{exporting === 'xlsx' ? 'Preparing…' : 'Excel'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.exportButton} onPress={() => downloadExport('docx')} disabled={Boolean(exporting)}>
                    <Text style={styles.exportButtonText}>{exporting === 'docx' ? 'Preparing…' : 'Word'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.exportButton} onPress={() => downloadExport('analytics')} disabled={Boolean(exporting)}>
                    <Text style={styles.exportButtonText}>{exporting === 'analytics' ? 'Preparing…' : 'Analytics'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionEyebrow}>Questions</Text>
                  <Text style={styles.sectionTitle}>Question insights</Text>
                </View>
              </View>
              <ScrollView style={styles.innerScroll} contentContainerStyle={styles.innerScrollContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {questions.length === 0 ? (
                  <Text style={styles.emptyText}>No questions added yet.</Text>
                ) : (
                  questions.map((question, index) => {
                    const analyticsQuestion = formAnalytics?.questions.find((item) => item.question_id === question.id);
                    const optionRows = analyticsQuestion?.options ?? [];
                    const averageRating = analyticsQuestion?.average_rating;
                    const textAnswers = analyticsQuestion?.text_answers ?? [];

                    return (
                      <View key={question.id} style={styles.questionAnalyticsCard}>
                        <View style={styles.questionRow}>
                          <View style={styles.indexBadge}><Text style={styles.indexText}>{index + 1}</Text></View>
                          <View style={styles.rowCopy}>
                            <Text style={styles.rowTitle}>{question.title}</Text>
                            <View style={styles.rowMetaTags}>
                              <MetaTag icon={getQuestionTypeIcon(question.question_type)} label={getQuestionTypeLabel(question.question_type)} />
                              <MetaTag icon={question.required ? 'check-circle' : 'circle'} label={question.required ? 'Required' : 'Optional'} />
                              {['radio', 'checkbox', 'dropdown'].includes(question.question_type) ? <MetaTag icon="list" label={`${question.options.length} option${question.options.length === 1 ? '' : 's'}`} /> : null}
                            </View>
                          </View>
                        </View>

                        {optionRows.length > 0 ? (
                          <View style={styles.questionInsightsGrid}>
                            <View style={styles.chartCardCompact}>
                              <ResponsePieChart
                                title={question.title}
                                rows={optionRows.map((item) => ({ label: item.option, value: item.count }))}
                                height={180}
                              />
                            </View>
                            <View style={styles.chartCardCompact}>
                              <HorizontalBarChart
                                title="Option breakdown"
                                rows={optionRows.map((item) => ({ label: item.option, value: item.count }))}
                                emptyLabel="No option values are available yet."
                              />
                            </View>
                          </View>
                        ) : averageRating !== null && averageRating !== undefined ? (
                          <View style={styles.ratingInsight}>
                            <Text style={styles.ratingInsightText}>Average rating: {averageRating}</Text>
                          </View>
                        ) : textAnswers.length ? (
                          <View style={styles.answerPreviewList}>
                            {textAnswers.slice(0, 3).map((answer, answerIndex) => (
                              <Text key={`${question.id}-${answerIndex}`} style={styles.answerPreviewText} numberOfLines={2}>
                                “{answer}”
                              </Text>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.emptyText}>No answer distribution is available for this question yet.</Text>
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>

            <View style={styles.panel}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.sectionEyebrow}>Responses</Text>
                  <Text style={styles.sectionTitle}>Collected answers</Text>
                </View>
              </View>
              <View style={styles.searchRow}>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search responses"
                  placeholderTextColor="#5EA0FF"
                  style={styles.searchInput}
                />
                <TouchableOpacity style={styles.searchButton} onPress={() => setSubmittedSearch(search)}>
                  <Text style={styles.searchText}>Search</Text>
                </TouchableOpacity>
              </View>
              {submittedSearch ? <Text style={styles.resultMeta}>{responses.length} results for "{submittedSearch}"</Text> : null}
              <ScrollView style={styles.innerScroll} contentContainerStyle={styles.innerScrollContent} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {responses.length === 0 ? (
                  <Text style={styles.emptyText}>No responses collected yet.</Text>
                ) : (
                  responses.map((response, index) => (
                    <ResponseDetailCard
                      key={response.id}
                      response={response}
                      detail={responseDetailsById.get(response.id)}
                      fallbackIndex={index + 1}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const MetaTag: React.FC<{ icon: React.ComponentProps<typeof Feather>['name']; label: string }> = ({ icon, label }) => (
  <View style={styles.metaTag}>
    <Feather name={icon} size={12} color={local.blue} style={styles.metaTagIcon} />
    <Text style={styles.metaTagText}>{label}</Text>
  </View>
);

const SummaryCard: React.FC<{ value: number | string; label: string; tone: 'blue' | 'green' | 'amber' | 'red' }> = ({
  value,
  label,
  tone,
}) => {
  const colors = {
    blue: '#ECE9FF',
    green: '#E8FAF7',
    amber: '#FFF6E6',
    red: '#FFF0F3',
  }[tone];

  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryAccent, { backgroundColor: colors }]} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
};

const StatTile: React.FC<{ icon: React.ComponentProps<typeof Feather>['name']; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={styles.metricTile}>
    <View style={styles.metricIconWrap}>
      <Feather name={icon} size={14} color={local.blue} />
    </View>
    <View style={styles.metricCopy}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  </View>
);

const ResponseDetailCard: React.FC<{
  response: ResponseItem;
  detail?: FormAnalytics['responses'][number];
  fallbackIndex: number;
}> = ({ response, detail, fallbackIndex }) => {
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
              <Text style={styles.answerQuestion}>{shortId(answer.question_id ?? '')}</Text>
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

const shortId = (value: string) => value.slice(0, 8);

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
  errorText: { color: local.red, fontWeight: '700' },
  internalHeader: { width: '100%', maxWidth: 980, flexDirection: 'row', alignItems: 'center', marginBottom: 14, padding: 14, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.76)', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', shadowColor: 'rgba(91, 75, 255, 0.10)', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.12, shadowRadius: 30, elevation: 10 },
  internalHeaderCopy: { flex: 1, paddingHorizontal: 14 },
  headerPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, backgroundColor: 'rgba(91, 75, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.12)', paddingHorizontal: 12, paddingVertical: 8 },
  headerPillText: { marginLeft: 6, color: local.blue, fontSize: 12, fontWeight: '900' },
  pageHeader: { width: '100%', maxWidth: 980, backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 28, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)' },
  pageHeadline: { alignItems: 'center' },
  pageEyebrow: { color: '#5B4BFF', fontWeight: '700', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  pageTitle: { color: '#172033', fontSize: 28, fontWeight: '900', lineHeight: 34, textAlign: 'center' },
  pageSubtitle: { color: '#6b7280', lineHeight: 20, textAlign: 'center', marginTop: 8, maxWidth: 720 },
  backButton: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(91, 75, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.12)' },
  summaryRow: { width: '100%', maxWidth: 980, flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  summaryCard: { flex: 1, minWidth: 140, backgroundColor: '#FBF7FF', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', padding: 16, overflow: 'hidden' },
  summaryAccent: { width: 42, height: 6, borderRadius: 999, marginBottom: 14 },
  summaryValue: { color: local.ink, fontSize: 28, fontWeight: '800' },
  summaryLabel: { color: local.muted, fontSize: 12, marginTop: 6, fontWeight: '700' },
  heroCard: { width: '100%', maxWidth: 980, backgroundColor: '#FBF7FF', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', padding: 16, marginBottom: 14, shadowColor: 'rgba(15, 23, 42, 0.08)', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 3 },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 },
  sectionEyebrow: { color: local.blue, fontWeight: '700', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  sectionTitle: { color: local.ink, fontSize: 18, fontWeight: '800' },
  sectionDescription: { color: local.muted, lineHeight: 20, marginTop: 6, fontWeight: '600' },
  livePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F0FF', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  livePillText: { color: local.blue, fontWeight: '800', marginLeft: 6, fontSize: 12 },
  heroMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricTile: { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', backgroundColor: local.soft, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: local.line },
  metricIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3ECFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  metricCopy: { flex: 1 },
  metricValue: { color: local.ink, fontWeight: '800', fontSize: 15 },
  metricLabel: { color: local.muted, fontSize: 12, marginTop: 2, fontWeight: '700' },
  grid: { width: '100%', maxWidth: 980, flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 14 },
  chartCard: { flex: 1, minWidth: 320, backgroundColor: '#FBF7FF', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', padding: 14, shadowColor: 'rgba(15, 23, 42, 0.06)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  chartCardCompact: { backgroundColor: local.soft, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', marginBottom: 12 },
  panel: { width: '100%', maxWidth: 980, backgroundColor: '#FBF7FF', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', padding: 16, marginBottom: 14, shadowColor: 'rgba(15, 23, 42, 0.06)', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  innerScroll: { maxHeight: 520 },
  innerScrollContent: { paddingBottom: 6 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  exportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exportButton: { backgroundColor: local.soft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: local.line },
  exportButtonText: { color: local.blue, fontSize: 12, fontWeight: '900' },
  emptyText: { color: local.muted, lineHeight: 20 },
  questionAnalyticsCard: { borderTopWidth: 1, borderTopColor: local.line, paddingVertical: 12 },
  questionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  indexBadge: { width: 34, height: 34, borderRadius: 8, backgroundColor: local.soft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  indexText: { color: local.blue, fontWeight: '900' },
  rowCopy: { flex: 1, marginRight: 8 },
  rowTitle: { color: local.ink, fontWeight: '900' },
  rowMeta: { color: local.muted, fontSize: 12, marginTop: 3 },
  rowMetaTags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  metaTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: local.soft, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, marginRight: 8, marginBottom: 8 },
  metaTagIcon: { marginRight: 4 },
  metaTagText: { color: local.blue, fontSize: 11, fontWeight: '700' },
  questionInsightsGrid: { marginTop: 8 },
  ratingInsight: { backgroundColor: local.soft, borderRadius: 12, padding: 12, marginTop: 8 },
  ratingInsightText: { color: local.ink, fontWeight: '800' },
  answerPreviewList: { backgroundColor: local.soft, borderRadius: 12, padding: 12, marginTop: 8, gap: 8 },
  answerPreviewText: { color: local.ink, fontWeight: '700', lineHeight: 20 },
  searchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: 220, minHeight: 46, borderRadius: 14, backgroundColor: '#FFFFFF', paddingHorizontal: 12, color: local.ink, marginRight: 8, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', maxWidth: 560, ...webInputReset },
  searchButton: { minHeight: 46, borderRadius: 14, backgroundColor: local.blue, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  searchText: { color: '#FFFFFF', fontWeight: '900' },
  resultMeta: { color: local.muted, fontWeight: '700', marginBottom: 12 },
  responseDetailCard: { backgroundColor: '#F7F1FF', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(91, 75, 255, 0.14)', padding: 14, marginTop: 12 },
  responseDetailTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  responseAvatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#ECE9FF', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  responseAvatarText: { color: local.blue, fontWeight: '900' },
  answerTable: { gap: 10, marginTop: 6 },
  answerRow: { backgroundColor: '#FDFBFF', borderRadius: 12, borderWidth: 1, borderColor: local.line, padding: 12 },
  answerQuestion: { color: local.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  answerValue: { color: local.ink, fontWeight: '700', lineHeight: 20 },
});
