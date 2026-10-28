import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { aiService, AiAnalysisResponse } from '../../api/ai-service';
import { formsService, FormItem } from '../../api/forms-service';
import { getErrorMessage } from '../../api/client';
import { AppStackParamList } from '../../navigation/NavigationTypes';

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

export const ResponseAnalyzerScreen: React.FC<NativeStackScreenProps<AppStackParamList, 'ResponseAnalyzer'>> = ({ navigation }) => {
  const [forms, setForms] = useState<FormItem[]>([]);
  const [formsLoading, setFormsLoading] = useState(true);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AiAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadForms = async () => {
      try {
        setFormsLoading(true);
        const response = await formsService.list();
        if (!isMounted) return;
        setForms(response.items);
        setSelectedFormId((current) => current || response.items[0]?.id || '');
      } catch (err) {
        if (isMounted) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setFormsLoading(false);
        }
      }
    };

    void loadForms();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedForm = useMemo(
    () => forms.find((form) => form.id === selectedFormId) ?? null,
    [forms, selectedFormId],
  );

  const runAnalysis = async () => {
    if (!selectedFormId) {
      setError('Choose a form to analyze.');
      return;
    }

    try {
      setAnalysisLoading(true);
      setError(null);
      const response = await aiService.analyzeForm(selectedFormId);
      setAnalysisResult(response);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      Alert.alert('Response analysis failed', message);
    } finally {
      setAnalysisLoading(false);
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
              <Text style={styles.eyebrow}>AI Response Analyzer</Text>
              <Text style={styles.title}>Turn submissions into clear signals.</Text>
              <Text style={styles.subtitle}>
                Pick a live form, run AI analysis, and get a report on response quality, recurring patterns, and quick wins.
              </Text>
            </View>
            <View style={styles.headerChip}>
              <Feather name="bar-chart-2" size={14} color={palette.primary} />
              <Text style={styles.headerChipText}>Response focused</Text>
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
                  <Feather name="activity" size={14} color={palette.primary} />
                  <Text style={styles.heroBadgeText}>Read the pattern</Text>
                </View>
                <Text style={styles.heroTitle}>
                  Ask AI what your respondents are actually telling you.
                </Text>
                <Text style={styles.heroText}>
                  This screen is for analysis only. Builder tools stay in AI Studio, while this page focuses on insight.
                </Text>
                <View style={styles.heroActions}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => void runAnalysis()}
                    disabled={analysisLoading || formsLoading || !selectedFormId}
                    activeOpacity={0.9}
                  >
                    {analysisLoading ? (
                      <ActivityIndicator size="small" color={palette.white} />
                    ) : (
                      <Text style={styles.primaryButtonText}>Analyze responses</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setAnalysisResult(null);
                      setError(null);
                      setSelectedFormId(forms[0]?.id ?? '');
                    }}
                    disabled={formsLoading}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.secondaryButtonText}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.heroStats}>
                <StatCard label="Forms" value={String(forms.length)} caption="available to analyze" />
                <StatCard
                  label="Selected"
                  value={selectedForm ? selectedForm.title : 'None'}
                  caption="current target"
                  compact
                />
                <StatCard label="Mode" value="Analysis" caption="AI response insights" />
              </View>
            </LinearGradient>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Choose form</Text>
                <Text style={styles.sectionTitle}>Select what AI should review</Text>
              </View>
              <View style={styles.sectionPill}>
                <Text style={styles.sectionPillText}>Live forms</Text>
              </View>
            </View>

            <Text style={styles.helperText}>
              Use the same visual style as AI Studio, but keep the analysis workflow isolated here so it reads like a dedicated tool.
            </Text>

            <View style={styles.formChipRow}>
              {formsLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={palette.primary} />
                  <Text style={styles.loadingRowText}>Loading forms...</Text>
                </View>
              ) : forms.length > 0 ? (
                forms.map((form) => (
                  <TouchableOpacity
                    key={form.id}
                    style={[styles.formChip, selectedFormId === form.id ? styles.formChipActive : null]}
                    activeOpacity={0.86}
                    onPress={() => setSelectedFormId(form.id)}
                  >
                    <Text style={[styles.formChipText, selectedFormId === form.id ? styles.formChipTextActive : null]} numberOfLines={1}>
                      {form.title}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.helperText}>No forms found yet. Create a form first, then return here to analyze it.</Text>
              )}
            </View>

            {selectedForm ? <Text style={styles.selectedText}>Selected: {selectedForm.title}</Text> : null}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => void runAnalysis()}
                disabled={analysisLoading || formsLoading || !selectedFormId}
                activeOpacity={0.9}
              >
                {analysisLoading ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Run analysis</Text>
                )}
              </TouchableOpacity>
              {selectedForm ? (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate('FormDetail', { formId: selectedForm.id })}
                  activeOpacity={0.9}
                >
                  <Text style={styles.secondaryButtonText}>Open form</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {analysisResult ? (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>AI response report</Text>
                  <Text style={styles.sectionTitle}>{analysisResult.title}</Text>
                </View>
                <View style={styles.sectionPill}>
                  <Text style={styles.sectionPillText}>Insight ready</Text>
                </View>
              </View>

              <Text style={styles.resultText}>{analysisResult.overview}</Text>
              {analysisResult.deep_overview ? <Text style={styles.resultRationale}>{analysisResult.deep_overview}</Text> : null}

              {analysisResult.metrics.length > 0 ? (
                <View style={styles.metricRow}>
                  {analysisResult.metrics.map((metric) => (
                    <View key={`${metric.label}-${metric.value}`} style={styles.metricChip}>
                      <Text style={styles.metricChipLabel}>{metric.label}</Text>
                      <Text style={styles.metricChipValue}>{metric.value}</Text>
                      {metric.detail ? <Text style={styles.metricChipDetail}>{metric.detail}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}

              <AnalysisBlock title="Strengths" items={analysisResult.strengths} color={palette.success} />
              <AnalysisBlock title="Issues" items={analysisResult.issues} color={palette.danger} />
              <AnalysisBlock title="Opportunities" items={analysisResult.opportunities} color={palette.secondary} />
              <AnalysisBlock title="Recommendations" items={analysisResult.recommendations} color={palette.primary} />
              <AnalysisBlock title="Quick wins" items={analysisResult.quick_wins} color={palette.amber} />

              {analysisResult.next_questions.length > 0 ? (
                <View style={styles.nextQuestionBox}>
                  <Text style={styles.listTitle}>Next questions</Text>
                  <View style={styles.tagRow}>
                    {analysisResult.next_questions.map((item) => (
                      <View key={item} style={styles.tag}>
                        <Text style={styles.tagText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No analysis yet</Text>
                <Text style={styles.emptyText}>
                  Pick a form and run the analyzer to see response insights, quality signals, and follow-up questions.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const StatCard: React.FC<{ label: string; value: string; caption: string; compact?: boolean }> = ({ label, value, caption, compact }) => (
  <View style={styles.statCard}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, compact ? styles.statValueCompact : null]} numberOfLines={1}>
      {value}
    </Text>
    <Text style={styles.statCaption}>{caption}</Text>
  </View>
);

const AnalysisBlock: React.FC<{ title: string; items: string[]; color: string }> = ({ title, items, color }) => (
  <View style={styles.analysisBlock}>
    <Text style={[styles.analysisBlockTitle, { color }]}>{title}</Text>
    {items.length > 0 ? (
      items.map((item, index) => (
        <View key={`${title}-${item}-${index}`} style={styles.analysisItem}>
          <View style={[styles.analysisDot, { backgroundColor: color }]} />
          <Text style={styles.analysisItemText}>{item}</Text>
        </View>
      ))
    ) : (
      <Text style={styles.analysisEmpty}>No items identified.</Text>
    )}
  </View>
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
  statValueCompact: {
    fontSize: 17,
  },
  statCaption: {
    marginTop: 4,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  card: {
    width: '100%',
    maxWidth: 860,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.14)',
    shadowColor: 'rgba(91, 75, 255, 0.10)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
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
  helperText: {
    marginTop: 10,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  formChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
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
  formChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(247, 241, 255, 0.88)',
    borderWidth: 1,
    borderColor: palette.line,
    maxWidth: 220,
  },
  formChipActive: {
    backgroundColor: 'rgba(91, 75, 255, 0.10)',
    borderColor: 'rgba(91, 75, 255, 0.22)',
  },
  formChipText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  formChipTextActive: {
    color: palette.primary,
  },
  selectedText: {
    marginTop: 10,
    color: palette.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  primaryButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  resultText: {
    marginTop: 12,
    color: palette.ink,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  resultRationale: {
    marginTop: 10,
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  metricChip: {
    flexGrow: 1,
    minWidth: 140,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(247, 241, 255, 0.88)',
    borderWidth: 1,
    borderColor: palette.line,
  },
  metricChipLabel: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricChipValue: {
    marginTop: 6,
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  metricChipDetail: {
    marginTop: 4,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  analysisBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  analysisBlockTitle: {
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  analysisItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
    lineHeight: 19,
  },
  nextQuestionBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: palette.line,
  },
  listTitle: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  tagText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  emptyState: {
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  emptyText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
});
