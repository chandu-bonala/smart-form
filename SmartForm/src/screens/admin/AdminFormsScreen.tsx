import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { adminService } from '../../api/admin-service';
import { getErrorMessage } from '../../api/client';
import { FormItem } from '../../api/forms-service';
import { AdminStackParamList } from '../../navigation/NavigationTypes';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminForms'>;

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

export const AdminFormsScreen: React.FC<Props> = ({ navigation }) => {
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const response = await adminService.listForms();
      setForms(response.items);
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

  const summary = useMemo(() => {
    return {
      published: forms.filter((form) => form.status === 'published').length,
      draft: forms.filter((form) => form.status === 'draft').length,
      archived: forms.filter((form) => form.status === 'archived').length,
    };
  }, [forms]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[palette.blue]} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Workspace</Text>
            <Text style={styles.title}>All forms</Text>
            <Text style={styles.subtitle}>Browse every form in the account, not just the ones you own.</Text>
          </View>
          <View style={styles.stats}>
            <StatPill label="Published" value={summary.published} tone="green" />
            <StatPill label="Drafts" value={summary.draft} tone="amber" />
            <StatPill label="Archived" value={summary.archived} tone="red" />
          </View>
        </View>

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

        <View style={styles.list}>
          {forms.map((form) => (
            <View key={form.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{form.title}</Text>
                  <Text style={styles.cardMeta} numberOfLines={2}>
                    {form.description || 'No description'}
                  </Text>
                </View>
                <View style={[styles.status, getStatusStyle(form.status)]}>
                  <Text style={[styles.statusText, getStatusTextStyle(form.status)]}>{form.status}</Text>
                </View>
              </View>

              <View style={styles.badgeRow}>
                <Badge label={`${form.questions?.length ?? 0} questions`} />
                <Badge label={form.is_public ? 'Public' : 'Private'} />
                <Badge label={form.is_hidden ? 'Hidden' : 'Visible'} />
              </View>

              <View style={styles.actions}>
                <ActionButton label="Open" icon="file-text" onPress={() => navigation.navigate('AdminFormDetail', { formId: form.id })} />
                <ActionButton label="Responses" icon="list" onPress={() => navigation.navigate('AdminFormResponses', { formId: form.id })} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const StatPill: React.FC<{ label: string; value: number; tone: 'green' | 'amber' | 'red' }> = ({ label, value, tone }) => (
  <View style={[styles.statPill, styles[`pill${tone}` as const]]}>
    <Text style={[styles.statValue, styles[`pillText${tone}` as const]]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Badge: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>{label}</Text>
  </View>
);

const ActionButton: React.FC<{ label: string; icon: any; onPress: () => void }> = ({ label, icon, onPress }) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress} activeOpacity={0.9}>
    <Feather name={icon} size={14} color={palette.blue} />
    <Text style={styles.actionButtonText}>{label}</Text>
  </TouchableOpacity>
);

const getStatusStyle = (status: string) => {
  if (status === 'published') return styles.statuspublished;
  if (status === 'archived') return styles.statusarchived;
  return styles.statusdraft;
};

const getStatusTextStyle = (status: string) => {
  if (status === 'published') return styles.statusTextpublished;
  if (status === 'archived') return styles.statusTextarchived;
  return styles.statusTextdraft;
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  scroll: { flex: 1 },
  container: { padding: 16, paddingBottom: 28 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  eyebrow: {
    color: palette.blue,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
  },
  subtitle: {
    color: palette.muted,
    marginTop: 4,
    lineHeight: 20,
    maxWidth: 520,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-start',
  },
  statPill: {
    minWidth: 92,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
  },
  pillgreen: { backgroundColor: '#E7FBF7' },
  pillamber: { backgroundColor: '#FFF6E6' },
  pillred: { backgroundColor: '#FFF0F3' },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  pillTextgreen: { color: palette.green },
  pillTextamber: { color: palette.amber },
  pillTextred: { color: palette.red },
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
  errorText: { color: palette.red, fontWeight: '700' },
  list: { gap: 12 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardCopy: { flex: 1 },
  cardTitle: { color: palette.ink, fontSize: 17, fontWeight: '900' },
  cardMeta: { color: palette.muted, marginTop: 4, lineHeight: 19 },
  status: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statuspublished: { backgroundColor: '#E7FBF7' },
  statusdraft: { backgroundColor: '#FFF6E6' },
  statusarchived: { backgroundColor: '#FFF0F3' },
  statusText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  statusTextpublished: { color: palette.green },
  statusTextdraft: { color: palette.amber },
  statusTextarchived: { color: palette.red },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: '#F7F3FF',
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: palette.blue,
    fontSize: 11,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: '#F7F3FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionButtonText: {
    color: palette.blue,
    marginLeft: 6,
    fontWeight: '800',
    fontSize: 12,
  },
});
