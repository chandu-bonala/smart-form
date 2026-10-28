import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { adminService, AdminDashboardSummary } from '../../api/admin-service';
import { getErrorMessage } from '../../api/client';
import { AdminStackParamList } from '../../navigation/NavigationTypes';
import { BrandMark } from '../../components/BrandMark';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminDashboard'>;

const palette = {
  background: '#F0E8FF',
  surface: '#FBF7FF',
  line: '#E3D8FF',
  ink: '#171429',
  muted: '#716C87',
  blue: '#7657F7',
  green: '#159A8A',
  amber: '#D88B20',
  red: '#D9576B',
};

export const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const [data, setData] = useState<AdminDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [summary] = await Promise.all([adminService.getDashboard()]);
      setData(summary);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[palette.blue]} />}
      >
        <LinearGradient colors={['#08112d', '#122b6f', '#6d28d9']} style={styles.hero}>
          <View style={styles.heroTopRow}>
            <BrandMark size={46} showLabel={false} compact containerStyle={styles.heroBrand} />
            <Text style={styles.heroEyebrow}>Admin command center</Text>
          </View>
          <Text style={styles.heroTitle}>You are signed in as admin.</Text>
          <Text style={styles.heroText}>
            Review users, forms, and workspace health from one elevated control panel.
          </Text>
          <View style={styles.heroActions}>
            <ActionButton label="Users" icon="users" onPress={() => navigation.navigate('AdminUsers')} />
            <ActionButton label="Forms" icon="file-text" onPress={() => navigation.navigate('AdminForms')} />
            <ActionButton label="Analytics" icon="bar-chart-2" onPress={() => navigation.navigate('AdminAnalytics')} />
          </View>
        </LinearGradient>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={palette.blue} />
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {data ? (
          <>
            <View style={styles.grid}>
              <MetricCard label="Users" value={data.total_users} color={palette.blue} />
              <MetricCard label="Admins" value={data.admin_users} color={palette.amber} />
              <MetricCard label="Forms" value={data.total_forms} color={palette.green} />
              <MetricCard label="Responses" value={data.total_responses} color={palette.red} />
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Workspace snapshot</Text>
              <View style={styles.snapshotRow}>
                <SnapshotChip label="Active users" value={data.active_users} />
                <SnapshotChip label="Verified" value={data.verified_users} />
                <SnapshotChip label="Published" value={data.published_forms} />
                <SnapshotChip label="Drafts" value={data.draft_forms} />
                <SnapshotChip label="Archived" value={data.archived_forms} />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const ActionButton: React.FC<{ label: string; icon: any; onPress: () => void }> = ({ label, icon, onPress }) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.9}>
    <Feather name={icon} size={16} color="#fff" />
    <Text style={styles.actionButtonText}>{label}</Text>
  </TouchableOpacity>
);

const MetricCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <View style={styles.metricCard}>
    <Text style={[styles.metricValue, { color }]}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const SnapshotChip: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={styles.snapshotChip}>
    <Text style={styles.snapshotValue}>{value}</Text>
    <Text style={styles.snapshotLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 28 },
  hero: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroBrand: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 4,
  },
  heroEyebrow: {
    color: '#DCE4FF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    marginTop: 8,
  },
  heroText: {
    color: '#E8EDFF',
    marginTop: 10,
    lineHeight: 20,
    fontWeight: '600',
    maxWidth: 680,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '800',
    marginLeft: 8,
  },
  loadingCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    marginBottom: 12,
  },
  errorCard: {
    backgroundColor: 'rgba(217, 87, 107, 0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 87, 107, 0.22)',
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: palette.red,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: palette.line,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  metricLabel: {
    color: palette.ink,
    marginTop: 4,
    fontWeight: '700',
  },
  panel: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
  },
  panelTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  snapshotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  snapshotChip: {
    minWidth: 120,
    backgroundColor: '#F7F3FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 12,
  },
  snapshotValue: {
    color: palette.blue,
    fontSize: 20,
    fontWeight: '900',
  },
  snapshotLabel: {
    color: palette.muted,
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
  },
});
