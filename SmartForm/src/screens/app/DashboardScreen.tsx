import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { analyticsService, AnalyticsDashboard } from '../../api/analytics-service';
import { getErrorMessage } from '../../api/client';
import { formsService, FormItem } from '../../api/forms-service';
import { useAuth } from '../../context/AuthContext';
import { AppStackParamList } from '../../navigation/NavigationTypes';
import { HorizontalBarChart, ResponsePieChart, TrendLineChart } from '../../components/TrendLineChart';

type DashboardScreenProps = NativeStackScreenProps<AppStackParamList, 'Dashboard'>;

const palette = {
  primary: '#5b4bff',
  secondary: '#2ea6ff',
  accent: '#7c3aed',
  white: '#FFFFFF',
  text: '#172033',
  subtle: '#6b7280',
  inactive: 'rgba(107, 114, 128, 0.78)',
  surface: 'rgba(255,255,255,0.84)',
  surfaceStrong: 'rgba(255,255,255,0.94)',
  wash: 'rgba(246, 245, 255, 0.82)',
  shadow: 'rgba(15, 23, 42, 0.12)',
};

const AUTO_REFRESH_INTERVAL_MS = 15000;

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 1080;
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      const [dashboard, formResponse] = await Promise.all([
        analyticsService.getDashboard(),
        formsService.list(),
      ]);
      setAnalytics(dashboard);
      setForms(formResponse.items);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
    const refreshTimer = setInterval(loadDashboard, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshTimer);
  }, [loadDashboard]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LinearGradient colors={['#08112d', '#122b6f', '#6d28d9']} style={styles.centeredContainer}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={palette.white} />
            <Text style={styles.loadingTitle}>Preparing your control center</Text>
            <Text style={styles.loadingText}>Loading forms, analytics, and workspace health.</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  const totalForms = analytics?.total_forms ?? forms.length;
  const totalResponses = analytics?.total_responses ?? 0;
  const completionRate = Math.round(analytics?.completion_rate ?? 0);
  const todayResponses = analytics?.daily_responses?.length
    ? analytics.daily_responses[analytics.daily_responses.length - 1]?.count ?? 0
    : 0;

  const trendRows = analytics?.daily_responses ?? [];
  const topFormRows = (analytics?.top_forms ?? []).map((item) => ({ label: item.label, value: item.value }));
  const breakdownRows = [
    { label: 'Responses', value: totalResponses },
    { label: 'Forms', value: totalForms },
    { label: 'Drafts', value: analytics?.draft_forms ?? 0 },
    { label: 'Live', value: analytics?.active_forms ?? 0 },
  ];

  const metrics = [
    {
      label: 'Forms',
      value: totalForms,
      caption: 'Published and draft forms',
      icon: 'file-text' as const,
      color: palette.primary,
    },
    {
      label: 'Drafts',
      value: analytics?.draft_forms ?? 0,
      caption: 'Work in progress',
      icon: 'edit-3' as const,
      color: '#f59e0b',
    },
    {
      label: 'Live',
      value: analytics?.active_forms ?? 0,
      caption: 'Currently published',
      icon: 'zap' as const,
      color: '#34c759',
    },
    {
      label: 'Responses',
      value: totalResponses,
      caption: 'Collected so far',
      icon: 'message-circle' as const,
      color: palette.secondary,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#07111f', '#122b6f', '#6d28d9']}
        style={[styles.page, !isWide && styles.pageStack]}
      >
        <View style={styles.pageGlowOne} />
        <View style={styles.pageGlowTwo} />

        {isSidebarOpen ? (
          <DashboardSidebar
            navigation={navigation}
            onToggle={() => setIsSidebarOpen(false)}
            isWide={isWide}
          />
        ) : (
          <View style={styles.collapsedRail}>
            <TouchableOpacity style={styles.railButton} onPress={() => setIsSidebarOpen(true)} activeOpacity={0.85}>
              <Feather name="menu" size={18} color={palette.white} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.contentPane}>
          <View style={styles.topBar}>
            <View style={styles.topBarCopy}>
              <Text style={styles.topBarEyebrow}>Workspace overview</Text>
              <Text style={styles.topBarTitle}>Dashboard</Text>
              <Text style={styles.topBarSubtitle}>
                A cleaner view of your forms, responses, and momentum.
              </Text>
            </View>

            <View style={styles.topBarActions}>
              <IconButton
                icon="bell"
                label="Notifications"
                badge="3"
                onPress={() => navigation.navigate('Analytics')}
              />
              <TouchableOpacity
                style={styles.aiButton}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('AiStudio')}
              >
                <Feather name="edit-3" size={16} color={palette.primary} />
                <Text style={styles.aiButtonText}>AI Builder</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.aiButton}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('ResponseAnalyzer')}
              >
                <Feather name="bar-chart-2" size={16} color={palette.primary} />
                <Text style={styles.aiButtonText}>Response AI</Text>
              </TouchableOpacity>
              <IconButton
                icon="user"
                label="Profile"
                onPress={() => navigation.navigate('Profile')}
              />
              <TouchableOpacity
                style={styles.createButton}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('FormCreate')}
              >
                <Feather name="plus" size={18} color={palette.white} />
                <Text style={styles.createButtonText}>Create form</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[palette.primary]}
                tintColor={palette.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <LinearGradient
                colors={['rgba(255,255,255,0.96)', 'rgba(240,246,255,0.96)', 'rgba(232,221,255,0.92)']}
                style={styles.heroGradient}
              >
                <View style={styles.heroCopy}>
                  <View style={styles.heroBadge}>
                    <Feather name="activity" size={14} color={palette.primary} />
                    <Text style={styles.heroBadgeText}>Performance pulse</Text>
                  </View>
                  <Text style={styles.heroTitle}>A calmer dashboard for forms that feel premium.</Text>
                  <Text style={styles.heroSubtitle}>
                    Watch response momentum, keep collections organized, and move between building and reviewing
                    without the visual noise.
                  </Text>
                  <View style={styles.heroActions}>
                    <TouchableOpacity
                      style={styles.primaryHeroButton}
                      activeOpacity={0.9}
                      onPress={() => navigation.navigate('FormCreate')}
                    >
                      <Feather name="plus-circle" size={18} color={palette.white} />
                      <Text style={styles.primaryHeroButtonText}>New form</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.secondaryHeroButton}
                      activeOpacity={0.9}
                      onPress={() => navigation.navigate('FormsList')}
                    >
                      <Feather name="folder" size={18} color={palette.primary} />
                      <Text style={styles.secondaryHeroButtonText}>View forms</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.heroStats}>
                  <StatTile label="Today" value={todayResponses.toString()} caption="responses" />
                  <StatTile label="Completion" value={`${completionRate}%`} caption="completion rate" />
                  <StatTile label="Forms" value={totalForms.toString()} caption="active workspace" />
                </View>
              </LinearGradient>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>We hit a snag</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.metricsGrid}>
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  icon={metric.icon}
                  label={metric.label}
                  value={metric.value.toString()}
                  caption={metric.caption}
                  color={metric.color}
                />
              ))}
            </View>

            <View style={styles.contentGrid}>
              <View style={styles.chartCard}>
                <TrendLineChart
                  rows={trendRows}
                  height={250}
                  title="Responses over time"
                  subtitle="A cleaner read on how submissions move through recent periods."
                />
              </View>

              <View style={styles.mixCard}>
                <Text style={styles.sectionEyebrow}>Workspace status</Text>
                <Text style={styles.sectionTitle}>Analyze in detail</Text>
                <Text style={styles.sectionDescription}>
                  Compare live forms, drafts, response volume, and workspace health in one calm view.
                </Text>
                <ResponsePieChart title="Form & response mix" rows={breakdownRows} height={220} />
              </View>
            </View>

            <View style={styles.contentGrid}>
              <View style={styles.chartCard}>
                <HorizontalBarChart
                  title="Top forms"
                  rows={topFormRows}
                  subtitle="Your most responsive forms at a glance."
                  emptyLabel="No top forms data is available yet."
                />
              </View>

              <View style={styles.insightCard}>
                <Text style={styles.sectionEyebrow}>Quick signals</Text>
                <Text style={styles.sectionTitle}>What to do next</Text>
                <InsightRow
                  icon="plus-circle"
                  title="Create a new form"
                  text="Spin up a clean form when you want to capture a new workflow."
                />
                <InsightRow
                  icon="share-2"
                  title="Share your best form"
                  text="Publish a link and let the clean layout do the first impression work."
                />
                <InsightRow
                  icon="bar-chart-2"
                  title="Review response trends"
                  text="Use the charts to spot momentum, plateaus, and high-performing forms."
                />
              </View>
            </View>

            <DashboardRecentForms
              forms={(analytics?.top_forms ?? []).map((item) => ({
                label: item.label,
                value: item.value,
                id: item.id,
              }))}
              navigation={navigation}
            />
          </ScrollView>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const DashboardSidebar: React.FC<{
  navigation: any;
  onToggle: () => void;
  isWide: boolean;
}> = ({ navigation, onToggle, isWide }) => {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeRoute, setActiveRoute] = useState('Dashboard');

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleNavigation = (routeName: string) => {
    setActiveRoute(routeName);
    navigation.navigate(routeName);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'AuthStack' }],
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <View style={[styles.sidebar, isWide ? styles.sidebarWide : styles.sidebarStack]}>
      <View>
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarBrand}>
            <View style={styles.sidebarMark}>
              <Feather name="grid" size={18} color={palette.primary} />
            </View>
            <View>
              <Text style={styles.sidebarTitle}>SmartForm</Text>
              <Text style={styles.sidebarSubtitle}>Premium workspace</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.sidebarCloseButton} onPress={onToggle} activeOpacity={0.8}>
            <Feather name="x" size={18} color={palette.subtle} />
          </TouchableOpacity>
        </View>

        <View style={styles.sidebarNav}>
          <SidebarNavItem
            icon="home"
            name="Dashboard"
            active={activeRoute === 'Dashboard'}
            onPress={() => handleNavigation('Dashboard')}
          />
          <SidebarNavItem
            icon="file-text"
            name="Forms"
            active={activeRoute === 'FormsList'}
            onPress={() => handleNavigation('FormsList')}
          />
          <SidebarNavItem
            icon="bar-chart-2"
            name="Analytics"
            active={activeRoute === 'Analytics'}
            onPress={() => handleNavigation('Analytics')}
          />
          <SidebarNavItem
            icon="settings"
            name="Settings"
            active={activeRoute === 'Profile'}
            onPress={() => handleNavigation('Profile')}
          />
        </View>
      </View>

      <View style={styles.sidebarFooter}>
        <View style={styles.sidebarProfileCard}>
          <View style={styles.sidebarAvatar}>
            <Text style={styles.sidebarAvatarText}>{initials}</Text>
          </View>
          <View style={styles.sidebarUserCopy}>
            <Text style={styles.sidebarUserName}>{user?.name ?? 'Guest User'}</Text>
            <Text style={styles.sidebarUserEmail}>{user?.email}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.sidebarLogoutButton} onPress={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? (
            <ActivityIndicator size="small" color={palette.primary} />
          ) : (
            <Feather name="log-out" size={18} color={palette.primary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const SidebarNavItem: React.FC<{ icon: any; name: string; active: boolean; onPress: () => void }> = ({
  icon,
  name,
  active,
  onPress,
}) => (
  <TouchableOpacity style={[styles.sidebarNavItem, active && styles.sidebarNavItemActive]} onPress={onPress} activeOpacity={0.85}>
    <View style={[styles.sidebarNavIcon, active && styles.sidebarNavIconActive]}>
      <Feather name={icon} size={18} color={active ? palette.white : palette.primary} />
    </View>
    <Text style={[styles.sidebarNavText, active && styles.sidebarNavTextActive]}>{name}</Text>
  </TouchableOpacity>
);

const DashboardRecentForms: React.FC<{
  forms: Array<{ label: string; value: number; id?: string }>;
  navigation: any;
}> = ({ forms, navigation }) => {
  return (
    <View style={styles.recentFormsCard}>
      <View style={styles.recentFormsHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>Recent activity</Text>
          <Text style={styles.sectionTitle}>Top forms</Text>
        </View>
        <View style={styles.recentFormsPill}>
          <Text style={styles.recentFormsPillText}>Popular</Text>
        </View>
      </View>

      {forms.length > 0 ? (
        <View style={styles.recentFormsList}>
          {forms.map((item) => (
            <TouchableOpacity
              key={item.id ?? `${item.label}-${item.value}`}
              style={styles.recentFormRow}
              onPress={() => {
                if (item.id) {
                  navigation.navigate('FormDetail', { formId: item.id });
                }
              }}
              activeOpacity={0.84}
            >
              <View style={styles.recentFormIcon}>
                <Feather name="file-text" size={18} color={palette.primary} />
              </View>
              <View style={styles.recentFormCopy}>
                <Text style={styles.recentFormName} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.recentFormMeta}>{item.value} responses</Text>
              </View>
              <Feather name="chevron-right" size={18} color={palette.subtle} />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.recentFormsEmpty}>
          <Text style={styles.recentFormsEmptyText}>No high-traffic forms yet.</Text>
        </View>
      )}
    </View>
  );
};

const StatTile: React.FC<{ label: string; value: string; caption: string }> = ({ label, value, caption }) => (
  <View style={styles.statTile}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statCaption}>{caption}</Text>
  </View>
);

const MetricCard: React.FC<{
  icon: any;
  label: string;
  value: string;
  caption: string;
  color: string;
}> = ({ icon, label, value, caption, color }) => (
  <View style={styles.metricCard}>
    <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
      <Feather name={icon} size={18} color={color} />
    </View>
    <Text style={styles.metricLabel}>{label}</Text>
    <Text style={[styles.metricValue, { color }]}>{value}</Text>
    <Text style={styles.metricCaption}>{caption}</Text>
  </View>
);

const InsightRow: React.FC<{ icon: any; title: string; text: string }> = ({ icon, title, text }) => (
  <View style={styles.insightRow}>
    <View style={styles.insightIcon}>
      <Feather name={icon} size={16} color={palette.primary} />
    </View>
    <View style={styles.insightCopy}>
      <Text style={styles.insightTitle}>{title}</Text>
      <Text style={styles.insightText}>{text}</Text>
    </View>
  </View>
);

const IconButton: React.FC<{
  icon: any;
  label: string;
  onPress: () => void;
  badge?: string;
}> = ({ icon, label, onPress, badge }) => (
  <TouchableOpacity style={styles.iconButton} activeOpacity={0.86} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
    <Feather name={icon} size={18} color={palette.primary} />
    {badge ? (
      <View style={styles.badgeBubble}>
        <Text style={styles.badgeBubbleText}>{badge}</Text>
      </View>
    ) : null}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  page: {
    flex: 1,
    flexDirection: 'row',
    padding: 18,
    gap: 16,
    position: 'relative',
  },
  pageStack: {
    flexDirection: 'column',
  },
  pageGlowOne: {
    position: 'absolute',
    top: -100,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(91, 75, 255, 0.12)',
  },
  pageGlowTwo: {
    position: 'absolute',
    left: -80,
    bottom: 60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(78, 132, 244, 0.10)',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    width: '86%',
    maxWidth: 420,
    paddingHorizontal: 28,
    paddingVertical: 26,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  loadingTitle: {
    marginTop: 12,
    color: palette.white,
    fontSize: 18,
    fontWeight: '800',
  },
  loadingText: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.76)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  collapsedRail: {
    width: 64,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 10,
  },
  railButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  sidebar: {
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 0,
    borderRadius: 28,
    padding: 18,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 8,
  },
  sidebarWide: {
    width: 282,
    justifyContent: 'space-between',
  },
  sidebarStack: {
    width: '100%',
    marginBottom: 12,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sidebarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sidebarMark: {
    width: 42,
    height: 42,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(91, 75, 255, 0.10)',
  },
  sidebarTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },
  sidebarSubtitle: {
    marginTop: 2,
    color: palette.subtle,
    fontSize: 12,
    fontWeight: '600',
  },
  sidebarCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  sidebarNav: {
    marginTop: 18,
    gap: 8,
  },
  sidebarNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 18,
  },
  sidebarNavItemActive: {
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  sidebarNavIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    marginRight: 12,
  },
  sidebarNavIconActive: {
    backgroundColor: palette.primary,
  },
  sidebarNavText: {
    color: palette.inactive,
    fontSize: 15,
    fontWeight: '700',
  },
  sidebarNavTextActive: {
    color: palette.text,
  },
  sidebarFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  sidebarProfileCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 250, 255, 0.96)',
    borderRadius: 20,
    padding: 12,
  },
  sidebarAvatar: {
    width: 42,
    height: 42,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.12)',
    marginRight: 10,
  },
  sidebarAvatarText: {
    color: palette.primary,
    fontWeight: '900',
  },
  sidebarUserCopy: {
    flex: 1,
  },
  sidebarUserName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  sidebarUserEmail: {
    marginTop: 2,
    color: palette.subtle,
    fontSize: 12,
  },
  sidebarLogoutButton: {
    width: 42,
    height: 42,
    marginLeft: 10,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  contentPane: {
    flex: 1,
    backgroundColor: 'rgba(245,248,255,0.92)',
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: palette.shadow,
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 16,
  },
  topBarCopy: {
    flex: 1,
    paddingRight: 10,
  },
  topBarEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.primary,
    marginBottom: 4,
  },
  topBarTitle: {
    color: palette.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
  },
  topBarSubtitle: {
    marginTop: 6,
    color: palette.subtle,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 560,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    position: 'relative',
  },
  badgeBubble: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeBubbleText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '900',
  },
  createButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(91, 75, 255, 0.3)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 8,
  },
  createButtonText: {
    marginLeft: 8,
    color: palette.white,
    fontSize: 13,
    fontWeight: '900',
  },
  aiButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.78)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
  },
  aiButtonText: {
    marginLeft: 8,
    color: palette.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
    gap: 18,
  },
  heroCard: {
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: 'rgba(91, 75, 255, 0.18)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 8,
  },
  heroGradient: {
    padding: 24,
    borderRadius: 30,
    flexDirection: 'row',
    gap: 18,
    alignItems: 'stretch',
  },
  heroCopy: {
    flex: 1.3,
    paddingRight: 6,
  },
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
    color: palette.text,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    maxWidth: 640,
  },
  heroSubtitle: {
    marginTop: 12,
    color: palette.subtle,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 620,
  },
  heroActions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  primaryHeroButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryHeroButtonText: {
    marginLeft: 8,
    color: palette.white,
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryHeroButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.74)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryHeroButtonText: {
    marginLeft: 8,
    color: palette.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  heroStats: {
    flex: 0.9,
    gap: 12,
    minWidth: 220,
  },
  statTile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 22,
    padding: 16,
    shadowColor: 'rgba(49, 34, 111, 0.08)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
  },
  statLabel: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  statValue: {
    marginTop: 8,
    color: palette.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
  },
  statCaption: {
    marginTop: 4,
    color: palette.subtle,
    fontSize: 12,
  },
  errorCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    marginBottom: 4,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#b91c1c',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#991b1b',
    lineHeight: 19,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: 180,
    borderRadius: 22,
    padding: 18,
    backgroundColor: palette.surface,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabel: {
    marginTop: 14,
    color: palette.subtle,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metricValue: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '900',
  },
  metricCaption: {
    marginTop: 4,
    color: palette.subtle,
    fontSize: 12,
    lineHeight: 18,
  },
  contentGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  chartCard: {
    flex: 1.25,
    minWidth: 320,
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  mixCard: {
    flex: 0.9,
    minWidth: 300,
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  insightCard: {
    flex: 0.9,
    minWidth: 300,
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: 16,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  sectionEyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    marginTop: 6,
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionDescription: {
    marginTop: 8,
    color: palette.subtle,
    fontSize: 13,
    lineHeight: 19,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(248, 250, 255, 0.96)',
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    marginRight: 12,
  },
  insightCopy: {
    flex: 1,
  },
  insightTitle: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
  },
  insightText: {
    marginTop: 4,
    color: palette.subtle,
    fontSize: 12,
    lineHeight: 18,
  },
  recentFormsCard: {
    backgroundColor: palette.surfaceStrong,
    borderRadius: 24,
    padding: 18,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  recentFormsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  recentFormsPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  recentFormsPillText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
  },
  recentFormsList: {
    marginTop: 14,
    gap: 10,
  },
  recentFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(248, 250, 255, 0.96)',
  },
  recentFormIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    marginRight: 12,
  },
  recentFormCopy: {
    flex: 1,
  },
  recentFormName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
  },
  recentFormMeta: {
    marginTop: 3,
    color: palette.subtle,
    fontSize: 12,
  },
  recentFormsEmpty: {
    marginTop: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(248, 250, 255, 0.96)',
  },
  recentFormsEmptyText: {
    color: palette.subtle,
    fontSize: 13,
  },
});
