import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { analyticsService, AnalyticsDashboard, UserAnalytics } from '../../api/analytics-service';
import { getErrorMessage } from '../../api/client';
import { HorizontalBarChart, ResponsePieChart, TrendLineChart } from '../../components/TrendLineChart';
import { Feather } from '@expo/vector-icons';
import { AppStackParamList } from '../../navigation/NavigationTypes';

type SegmentKey = 'forms' | 'devices' | 'browsers';
type BreakdownPoint = { label: string; value: number };
type TrendPoint = { date: string; count: number };

const local = {
  background: '#F0E8FF',
  surface: '#FBF7FF',
  surfaceSoft: '#F4EEFF',
  ink: '#171429',
  muted: '#716C87',
  line: '#E3D8FF',
  blue: '#7657F7',
  blueSoft: '#ECE9FF',
  green: '#159A8A',
  greenSoft: '#E8FAF7',
  amber: '#D88B20',
  amberSoft: '#FFF6E6',
  red: '#D9576B',
  redSoft: '#FFF0F3',
};

const AUTO_REFRESH_INTERVAL_MS = 8000;

export const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [users, setUsers] = useState<UserAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState<SegmentKey>('forms');
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [dashboardResult, userResult] = await Promise.all([
        analyticsService.getDashboard(),
        analyticsService.getUsers(),
      ]);
      setData(dashboardResult);
      setUsers(userResult);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const refreshTimer = setInterval(() => {
      loadData();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(refreshTimer);
  }, [loadData]);

  const trendRows = useMemo(() => {
    const rows = data?.daily_responses?.length ? data.daily_responses : data?.monthly_responses ?? [];
    return rows.slice(-12);
  }, [data]);

  const selectedRows = useMemo<BreakdownPoint[]>(() => {
    if (!data) return [];
    if (segment === 'devices') return data.device_statistics;
    if (segment === 'browsers') return data.browser_statistics;
    return data.top_forms.map((item) => ({ label: item.label, value: item.value }));
  }, [data, segment]);

  const topFormRows = useMemo<BreakdownPoint[]>(
    () => (data?.top_forms ?? []).map((item) => ({ label: item.label, value: item.value })),
    [data],
  );

  const mixRows = useMemo<BreakdownPoint[]>(
    () => [
      { label: 'Responses', value: data?.total_responses ?? 0 },
      { label: 'Forms', value: data?.total_forms ?? 0 },
      { label: 'Drafts', value: data?.draft_forms ?? 0 },
      { label: 'Live', value: data?.active_forms ?? 0 },
    ],
    [data],
  );

  const activeRate = data?.total_forms ? Math.min(100, Math.round(((data.active_forms ?? 0) / data.total_forms) * 100)) : 0;
  const verifiedRate = users?.total_users ? Math.round((users.verified_users / users.total_users) * 100) : 0;
  const todayResponses = trendRows.length ? trendRows[trendRows.length - 1]?.count ?? 0 : 0;
  const averageCompletion = data?.average_completion_time ? `${Math.round(data.average_completion_time)}s` : '0s';

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[local.blue]} />}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={['#F6F5FF', '#EEF2FF', '#F6F5FF']} style={styles.background}>
        <View style={styles.backgroundLayer} pointerEvents="none">
          <View style={styles.bgGlowOne} />
          <View style={styles.bgGlowTwo} />
          <View style={styles.bgGlowThree} />
        </View>
        <View style={styles.shell}>
          <View style={styles.internalHeader}>
            <TouchableOpacity style={styles.backButton} activeOpacity={0.86} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}>
              <Feather name="arrow-left" size={18} color={local.blue} />
            </TouchableOpacity>
            <View style={styles.internalHeaderCopy}>
              <Text style={styles.pageEyebrow}>Workspace analytics</Text>
              <Text style={styles.pageTitle}>Analytics</Text>
            </View>
            <View style={styles.headerChip}>
              <Feather name="activity" size={14} color={local.blue} />
              <Text style={styles.headerChipText}>Live refresh</Text>
            </View>
          </View>

          <LinearGradient colors={['rgba(8,17,45,0.02)', 'rgba(18,43,111,0.02)', 'rgba(109,40,217,0.02)']} style={styles.hero}>
            <View style={styles.heroGlow} />
            <Text style={styles.eyebrow}>Analytics command center</Text>
            <Text style={styles.title}>See the whole workspace in one calm view.</Text>
            <Text style={styles.subtitle}>
              Response flow, form health, and audience signals sit together so the important story is easy to read at a glance.
            </Text>
            <View style={styles.heroStats}>
              <HeroStat label="Today" value={String(todayResponses)} />
              <HeroStat label="Avg time" value={averageCompletion} />
              <HeroStat label="Active" value={`${activeRate}%`} />
              <HeroStat label="Verified users" value={`${verifiedRate}%`} />
            </View>
          </LinearGradient>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={local.blue} />
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {data ? (
            <>
              <View style={styles.kpiGrid}>
                <AnalyticsMetricCard icon="file-text" label="Forms" value={data.total_forms.toString()} color="#5b4bff" description={`${data.draft_forms} drafts`} />
                <AnalyticsMetricCard icon="bar-chart-2" label="Responses" value={data.total_responses.toString()} color="#28c76f" description="collected so far" />
                <AnalyticsMetricCard icon="file" label="Published" value={data.active_forms.toString()} color="#f59e0b" description={`${activeRate}% active`} />
                <AnalyticsMetricCard icon="trending-up" label="Completion" value={`${Math.min(data.completion_rate, 100)}%`} color="#ef4444" description="collection rate" />
              </View>

              <View style={styles.sectionGrid}>
                <View style={styles.chartCard}>
                  <TrendLineChart
                    rows={trendRows}
                    maxValue={Math.max(1, ...trendRows.map((item) => item.count))}
                    height={260}
                    title="Response velocity"
                    subtitle="Tracks submissions over the latest periods available from the API."
                  />
                </View>

                <View style={styles.chartCard}>
                  <ResponsePieChart
                    title="Workspace mix"
                    rows={mixRows}
                    height={220}
                    subtitle="Compare the amount of responses, forms, drafts, and live forms."
                  />
                </View>
              </View>

              <View style={styles.sectionGrid}>
                <View style={styles.chartCard}>
                  <View style={styles.chartHeader}>
                    <View style={styles.chartHeaderCopy}>
                      <Text style={styles.sectionEyebrow}>Breakdown</Text>
                      <Text style={styles.sectionTitle}>Compare by segment</Text>
                      <Text style={styles.sectionDescription}>
                        Switch between forms, devices, and browsers for a clean share comparison.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.segmentedControl}>
                    <SegmentButton label="Forms" active={segment === 'forms'} onPress={() => setSegment('forms')} />
                    <SegmentButton label="Devices" active={segment === 'devices'} onPress={() => setSegment('devices')} />
                    <SegmentButton label="Browsers" active={segment === 'browsers'} onPress={() => setSegment('browsers')} />
                  </View>
                  <ResponsePieChart
                    title={segment === 'forms' ? 'Top forms by responses' : segment === 'devices' ? 'Device split' : 'Browser split'}
                    rows={selectedRows}
                    height={210}
                  />
                </View>

                <View style={styles.chartCard}>
                  <HorizontalBarChart
                    title="Top forms"
                    rows={topFormRows}
                    subtitle="Forms with the strongest response volume."
                    emptyLabel="No top forms data is available yet."
                  />
                </View>
              </View>

              <View style={styles.healthCard}>
                <View style={styles.chartHeader}>
                  <View style={styles.chartHeaderCopy}>
                    <Text style={styles.sectionEyebrow}>Workspace health</Text>
                    <Text style={styles.sectionTitle}>Operational snapshot</Text>
                    <Text style={styles.sectionDescription}>
                      Keep an eye on publishing balance, response depth, and user activity.
                    </Text>
                  </View>
                </View>

                <View style={styles.healthRow}>
                  <HealthMeter label="Published forms" value={activeRate} />
                  <HealthMeter label="Verified users" value={verifiedRate} />
                </View>

                <View style={styles.healthInsights}>
                  <InsightRow
                    label="Draft backlog"
                    value={`${data.draft_forms} drafts`}
                    description={data.draft_forms > data.active_forms ? 'Publish ready forms or archive stale drafts.' : 'Draft volume is balanced.'}
                  />
                  <InsightRow
                    label="Response depth"
                    value={`${data.total_responses} submissions`}
                    description={data.total_responses > 0 ? 'Response collection is active.' : 'Share a published form to begin collecting data.'}
                  />
                  {users ? (
                    <InsightRow
                      label="User base"
                      value={`${users.active_users}/${users.total_users} active`}
                      description={`${users.admin_users} admin users, ${users.verified_users} verified profiles.`}
                    />
                  ) : null}
                </View>
              </View>
            </>
          ) : null}
        </View>
      </LinearGradient>
    </ScrollView>
  );
};

const HeroStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.heroStat}>
    <Text style={styles.heroStatLabel}>{label}</Text>
    <Text style={styles.heroStatValue}>{value}</Text>
  </View>
);

const SegmentButton: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.segmentButton, active ? styles.segmentButtonActive : null]}
    activeOpacity={0.85}
    onPress={onPress}
  >
    <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{label}</Text>
  </TouchableOpacity>
);

const HealthMeter: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={styles.healthMeter}>
    <View style={styles.healthTop}>
      <Text style={styles.healthLabel}>{label}</Text>
      <Text style={styles.healthValue}>{value}%</Text>
    </View>
    <View style={styles.healthTrack}>
      <View style={[styles.healthFill, { width: `${Math.min(value, 100)}%` }]} />
    </View>
  </View>
);

const InsightRow: React.FC<{ label: string; value: string; description: string }> = ({ label, value, description }) => (
  <View style={styles.insightRow}>
    <View style={styles.insightCopy}>
      <Text style={styles.insightLabel}>{label}</Text>
      <Text style={styles.insightDescription}>{description}</Text>
    </View>
    <Text style={styles.insightValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: local.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
    alignItems: 'center',
  },
  background: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgGlowOne: {
    position: 'absolute',
    top: -70,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(91, 75, 255, 0.16)',
  },
  bgGlowTwo: {
    position: 'absolute',
    top: 140,
    right: -110,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(46, 166, 255, 0.14)',
  },
  bgGlowThree: {
    position: 'absolute',
    bottom: -120,
    left: '16%',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(168, 111, 255, 0.10)',
  },
  shell: {
    width: '100%',
    maxWidth: 1100,
  },
  internalHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
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
  internalHeaderCopy: {
    flex: 1,
    paddingHorizontal: 14,
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
  },
  headerChipText: {
    color: local.blue,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },
  pageEyebrow: {
    color: local.blue,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  pageTitle: {
    color: local.ink,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  hero: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#FBF7FF',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.14)',
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  heroGlow: {
    position: 'absolute',
    right: -24,
    top: -24,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(91, 75, 255, 0.10)',
  },
  eyebrow: {
    color: local.blue,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  title: {
    color: local.ink,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
    lineHeight: 34,
  },
  subtitle: {
    color: local.muted,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 720,
    fontWeight: '600',
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  heroStat: {
    minWidth: 132,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
  },
  heroStatLabel: {
    color: local.blue,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroStatValue: {
    color: local.ink,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  loadingBox: {
    backgroundColor: local.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: 'rgba(15, 23, 42, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: local.red,
    fontWeight: '700',
  },
  kpiGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: local.surface,
    borderRadius: 18,
    padding: 16,
    shadowColor: 'rgba(15, 23, 42, 0.10)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(91, 75, 255, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricContent: {
    marginTop: 12,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    color: local.ink,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  metricDescription: {
    color: local.muted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 16,
  },
  chartCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: local.surface,
    borderRadius: 22,
    padding: 14,
    shadowColor: 'rgba(15, 23, 42, 0.08)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  chartHeader: {
    marginBottom: 10,
  },
  chartHeaderCopy: {
    gap: 2,
  },
  sectionEyebrow: {
    color: local.blue,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: local.ink,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  sectionDescription: {
    color: local.muted,
    lineHeight: 20,
    marginTop: 4,
    fontWeight: '600',
  },
  segmentedControl: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  segmentButton: {
    borderRadius: 999,
    backgroundColor: local.surfaceSoft,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  segmentButtonActive: {
    backgroundColor: local.blue,
  },
  segmentText: {
    color: local.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  healthCard: {
    backgroundColor: local.surface,
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
    shadowColor: 'rgba(15, 23, 42, 0.08)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  healthRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  healthMeter: {
    flex: 1,
    minWidth: 240,
    backgroundColor: local.surfaceSoft,
    borderRadius: 16,
    padding: 14,
  },
  healthTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  healthLabel: {
    color: local.ink,
    fontWeight: '800',
  },
  healthValue: {
    color: local.blue,
    fontWeight: '900',
  },
  healthTrack: {
    height: 10,
    backgroundColor: '#E9E4FF',
    borderRadius: 999,
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    backgroundColor: local.blue,
    borderRadius: 999,
  },
  healthInsights: {
    marginTop: 12,
    gap: 10,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: local.surfaceSoft,
    borderRadius: 16,
    padding: 14,
  },
  insightCopy: {
    flex: 1,
    paddingRight: 8,
  },
  insightLabel: {
    color: local.ink,
    fontWeight: '900',
  },
  insightDescription: {
    color: local.muted,
    marginTop: 4,
    lineHeight: 19,
    fontWeight: '600',
  },
  insightValue: {
    color: local.blue,
    fontWeight: '900',
  },
});

const AnalyticsMetricCard: React.FC<{ icon: any; label: string; value: string; color: string; description: string }> = ({
  icon,
  label,
  value,
  color,
  description,
}) => (
  <View style={styles.metricCard}>
    <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
      <Feather name={icon} size={18} color={color} />
    </View>
    <View style={styles.metricContent}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricDescription}>{description}</Text>
    </View>
  </View>
);
