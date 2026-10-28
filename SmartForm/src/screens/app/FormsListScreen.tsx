import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import QRCode from 'qrcode';
import { SvgXml } from 'react-native-svg';
import { getErrorMessage } from '../../api/client';
import { FormItem, formsService } from '../../api/forms-service';
import { AppStackParamList } from '../../navigation/NavigationTypes';
import { WEB_BASE_URL } from '../../constants/api';
import { webInputReset } from '../../utils/webInputReset';

type FilterKey = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'HIDDEN';

const palette = {
  page: '#F0E8FF',
  surface: '#FBF7FF',
  ink: '#172033',
  muted: '#6B7280',
  line: '#E3D8FF',
  wash: '#F4EEFF',
  primary: '#5B4BFF',
  primarySoft: '#ECE9FF',
  success: '#159A8A',
  successSoft: '#E8FAF7',
  warning: '#D88B20',
  warningSoft: '#FFF6E6',
  danger: '#D9576B',
  dangerSoft: '#FFF0F3',
  navy: '#31226F',
  white: '#FFFFFF',
  shadow: 'rgba(15, 23, 42, 0.12)',
};

const AUTO_REFRESH_INTERVAL_MS = 12000;

export const FormsListScreen: React.FC<NativeStackScreenProps<AppStackParamList, 'FormsList'>> = ({ navigation }) => {
  const [forms, setForms] = useState<FormItem[]>([]);
  const [versionCounts, setVersionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrForm, setQrForm] = useState<FormItem | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const loadForms = useCallback(async () => {
    try {
      setError(null);
      const response = await formsService.list();
      setForms(response.items);

      const counts = await Promise.all(
        response.items.map(async (form) => {
          try {
            const versions = await formsService.listVersions(form.id);
            return [form.id, versions.total] as const;
          } catch {
            return [form.id, 0] as const;
          }
        }),
      );

      setVersionCounts(Object.fromEntries(counts));
      setLastSyncedAt(new Date());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadForms();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [loadForms]);

  const counts = useMemo(
    () => ({
      visible: forms.filter((form) => !form.is_hidden).length,
      published: forms.filter((form) => form.status.toLowerCase() === 'published').length,
      drafts: forms.filter((form) => form.status.toLowerCase() === 'draft').length,
      hidden: forms.filter((form) => form.is_hidden).length,
    }),
    [forms],
  );

  const filteredForms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return forms.filter((form) => {
      const status = form.status.toUpperCase();
      const matchesFilter = filter === 'ALL' || (filter === 'HIDDEN' ? form.is_hidden : status === filter && !form.is_hidden);
      const matchesQuery = !normalized
        || form.title.toLowerCase().includes(normalized)
        || (form.description ?? '').toLowerCase().includes(normalized)
        || form.form_slug.toLowerCase().includes(normalized);
      return matchesFilter && matchesQuery;
    });
  }, [filter, forms, query]);

  const onRefresh = () => {
    setRefreshing(true);
    loadForms();
  };

  const replaceForm = (updated: FormItem) => {
    setForms((current) => current.map((form) => (form.id === updated.id ? updated : form)));
  };

  const openQr = async (form: FormItem) => {
    const publicUrl = `${WEB_BASE_URL}/public/forms/${form.form_slug}`;
    setQrForm(form);
    setQrVisible(true);
    setQrSvg(null);

    try {
      setQrLoading(true);
      const svg = await QRCode.toString(publicUrl, {
        type: 'svg',
        width: 280,
        margin: 1,
        color: {
          dark: '#172033',
          light: '#FFFFFF',
        },
      });
      setQrSvg(svg);
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      Alert.alert('QR code failed', message);
      setQrVisible(false);
      setQrForm(null);
    } finally {
      setQrLoading(false);
    }
  };

  const runAction = async (formId: string, action: () => Promise<void>) => {
    try {
      setBusyId(formId);
      setError(null);
      await action();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const publish = (form: FormItem) => runAction(form.id, async () => {
    const updated = await formsService.publish(form.id);
    replaceForm(updated);
    const versions = await formsService.listVersions(form.id);
    setVersionCounts((current) => ({ ...current, [form.id]: versions.total }));
  });

  const toggleHidden = (form: FormItem) => runAction(form.id, async () => {
    const updated = await formsService.setHidden(form.id, !form.is_hidden);
    replaceForm(updated);
  });

  const duplicate = (form: FormItem) => runAction(form.id, async () => {
    const copy = await formsService.duplicate(form.id);
    setForms((current) => [copy, ...current]);
    setVersionCounts((current) => ({ ...current, [copy.id]: 0 }));
  });

  const remove = (form: FormItem) => {
    Alert.alert('Delete form', `Delete "${form.title}" and all responses?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => runAction(form.id, async () => {
          await formsService.delete(form.id);
          setForms((current) => current.filter((item) => item.id !== form.id));
        }),
      },
    ]);
  };

  const refreshLabel = lastSyncedAt
    ? `Auto-refresh every ${Math.round(AUTO_REFRESH_INTERVAL_MS / 1000)}s · updated ${lastSyncedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : `Auto-refresh every ${Math.round(AUTO_REFRESH_INTERVAL_MS / 1000)}s`;

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Dashboard');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#F6F5FF', '#EEF2FF', '#F6F5FF']} style={styles.shellGradient}>
        <View style={styles.backgroundLayer} pointerEvents="none">
          <View style={styles.bgGlowOne} />
          <View style={styles.bgGlowTwo} />
          <View style={styles.bgGlowThree} />
        </View>
        <View style={styles.workspacePane}>
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[palette.primary]} tintColor={palette.primary} />}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.internalHeader}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.85}>
                <Feather name="arrow-left" size={18} color={palette.primary} />
              </TouchableOpacity>
              <View style={styles.internalHeaderCopy}>
                <Text style={styles.internalHeaderEyebrow}>Workspace view</Text>
                <Text style={styles.internalHeaderTitle}>My Forms</Text>
              </View>
              <View style={styles.internalHeaderSpacer} />
            </View>

            <View style={styles.heroCard}>
              <LinearGradient colors={['rgba(247,241,255,0.96)', 'rgba(236,229,255,0.94)', 'rgba(226,244,255,0.90)']} style={styles.heroGradient}>
                <View style={styles.heroGlow} />
                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>Manage forms</Text>
                  <Text style={styles.heroTitle}>Keep every form organized, visible, and ready to ship.</Text>
                  <Text style={styles.heroSubtitle}>
                    Search, filter, publish, duplicate, and hide forms from a workspace view that refreshes itself automatically.
                  </Text>
                  <Text style={styles.refreshText}>{refreshLabel}</Text>
                </View>
                <TouchableOpacity style={styles.heroAction} activeOpacity={0.9} onPress={() => navigation.navigate('FormCreate')}>
                  <Feather name="plus-circle" size={18} color={palette.surface} />
                  <Text style={styles.heroActionText}>New form</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard label="Visible" value={counts.visible} color={palette.primary} icon="eye" description="Ready to review" />
              <MetricCard label="Live" value={counts.published} color={palette.success} icon="check-circle" description="Currently published" />
              <MetricCard label="Drafts" value={counts.drafts} color={palette.warning} icon="file-text" description="In progress" />
              <MetricCard label="Hidden" value={counts.hidden} color={palette.navy} icon="lock" description="Paused from public view" />
            </View>

            <View style={styles.toolbar}>
              <View style={styles.searchRow}>
                <Feather name="search" size={16} color={palette.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search forms, slugs, descriptions"
                  placeholderTextColor="#5EA0FF"
                  autoCapitalize="none"
                  style={styles.searchInput}
                />
              </View>
              <View style={styles.filters}>
                {(['ALL', 'PUBLISHED', 'DRAFT', 'HIDDEN'] as FilterKey[]).map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={[styles.filter, filter === item ? styles.filterActive : null]}
                    activeOpacity={0.84}
                    onPress={() => setFilter(item)}
                  >
                    <Text style={[styles.filterText, filter === item ? styles.filterTextActive : null]}>
                      {item === 'ALL' ? 'All forms' : item === 'PUBLISHED' ? 'Live' : item === 'DRAFT' ? 'Drafts' : 'Hidden'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorTitle}>Something needs attention</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {loading ? <ActivityIndicator style={styles.loader} size="large" color={palette.primary} /> : null}

            {!loading && filteredForms.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Nothing matches this view</Text>
                <Text style={styles.emptyText}>Try another filter or create a new form to start capturing responses.</Text>
              </View>
            ) : null}

            {filteredForms.map((form) => {
              const published = form.status.toLowerCase() === 'published';
              const busy = busyId === form.id;
              return (
                <View key={form.id} style={[styles.formCard, form.is_hidden ? styles.formCardMuted : null]}>
                  <TouchableOpacity activeOpacity={0.84} onPress={() => navigation.navigate('FormDetail', { formId: form.id })}>
                    <View style={styles.cardTop}>
                      <View style={styles.formIdentity}>
                        <View style={[styles.formMark, published ? styles.formMarkLive : styles.formMarkDraft]}>
                          <Feather name="file-text" size={18} color={published ? palette.success : palette.warning} />
                        </View>
                        <View style={styles.formCopy}>
                          <Text style={styles.formTitle} numberOfLines={1}>{form.title}</Text>
                          <Text style={styles.formSlug} numberOfLines={1}>{form.form_slug}</Text>
                        </View>
                      </View>
                      <StatusLabel status={form.status} hidden={form.is_hidden} />
                    </View>
                    <Text style={styles.description} numberOfLines={2}>{form.description || 'No description added yet.'}</Text>
                  </TouchableOpacity>

                  <View style={styles.statsRow}>
                    <MiniStat label="Questions" value={form.questions?.length ?? 0} />
                    <MiniStat label="Versions" value={versionCounts[form.id] ?? 0} />
                    <MiniStat label="Email" value={form.collect_email ? 'On' : 'Off'} />
                    <MiniStat label="Access" value={form.is_public ? 'Public' : 'Private'} />
                  </View>

                  <View style={styles.actions}>
                    <Action label="Open" onPress={() => navigation.navigate('FormDetail', { formId: form.id })} />
                    {!published ? <Action label="Publish" loading={busy} strong onPress={() => publish(form)} /> : null}
                    <Action label={form.is_hidden ? 'Unhide' : 'Hide'} loading={busy} onPress={() => toggleHidden(form)} />
                    <Action label="Duplicate" loading={busy} onPress={() => duplicate(form)} />
                    <Action label="QR" icon="grid" loading={busy} onPress={() => void openQr(form)} />
                    <Action label="Delete" loading={busy} danger onPress={() => remove(form)} />
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>Public URL QR</Text>
                  <Text style={styles.modalTitle}>{qrForm?.title ?? 'Form QR code'}</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setQrVisible(false);
                    setQrForm(null);
                    setQrSvg(null);
                  }}
                >
                  <Feather name="x" size={18} color={palette.muted} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalText}>
                Scan this QR code to open the public form page directly.
              </Text>

              <View style={styles.qrCard}>
                {qrLoading ? (
                  <ActivityIndicator size="large" color={palette.primary} />
                ) : qrSvg ? (
                  <SvgXml xml={qrSvg} width={250} height={250} />
                ) : null}
              </View>

              <Text style={styles.publicUrlLabel}>Public URL</Text>
              <Text style={styles.publicUrlText} selectable>
                {qrForm ? `${WEB_BASE_URL}/public/forms/${qrForm.form_slug}` : ''}
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.secondaryModalButton}
                  onPress={() => qrForm && Linking.openURL(`${WEB_BASE_URL}/public/forms/${qrForm.form_slug}`)}
                >
                  <Text style={styles.secondaryModalButtonText}>Open link</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryModalButton}
                  onPress={() => {
                    setQrVisible(false);
                    setQrForm(null);
                    setQrSvg(null);
                  }}
                >
                  <Text style={styles.primaryModalButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </SafeAreaView>
  );
};

const MetricCard: React.FC<{ label: string; value: number; color: string; icon: any; description: string }> = ({ label, value, color, icon, description }) => (
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

const MiniStat: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <View style={styles.miniStat}>
    <Text style={styles.miniValue}>{value}</Text>
    <Text style={styles.miniLabel}>{label}</Text>
  </View>
);

const StatusLabel: React.FC<{ status: string; hidden: boolean }> = ({ status, hidden }) => {
  const live = status.toLowerCase() === 'published';
  const background = hidden ? palette.primarySoft : live ? palette.successSoft : palette.warningSoft;
  const color = hidden ? palette.primary : live ? palette.success : palette.warning;
  return (
    <View style={[styles.status, { backgroundColor: background }]}>
      <Text style={[styles.statusText, { color }]}>{hidden ? 'Hidden' : live ? 'Live' : 'Draft'}</Text>
    </View>
  );
};

const Action: React.FC<{ label: string; onPress: () => void; loading?: boolean; strong?: boolean; danger?: boolean; icon?: any }> = ({
  label,
  onPress,
  loading,
  strong,
  danger,
  icon,
}) => (
  <TouchableOpacity
    style={[styles.action, strong ? styles.actionStrong : null, danger ? styles.actionDanger : null]}
    activeOpacity={0.84}
    disabled={loading}
    onPress={onPress}
  >
    {loading ? (
      <ActivityIndicator size="small" color={strong ? palette.surface : danger ? palette.danger : palette.ink} />
    ) : (
      <View style={styles.actionContent}>
        {icon ? <Feather name={icon} size={14} color={danger ? palette.danger : strong ? palette.surface : palette.ink} /> : null}
        <Text
          style={[
            styles.actionText,
            strong ? styles.actionTextStrong : null,
            danger ? styles.actionTextDanger : null,
          ]}
        >
          {label}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  shellGradient: { flex: 1, padding: 16, position: 'relative' },
  backgroundLayer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bgGlowOne: { position: 'absolute', top: -70, left: -90, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(91, 75, 255, 0.16)' },
  bgGlowTwo: { position: 'absolute', top: 140, right: -110, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(46, 166, 255, 0.14)' },
  bgGlowThree: { position: 'absolute', bottom: -120, left: '16%', width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(168, 111, 255, 0.10)' },
  workspacePane: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.14)',
    shadowColor: 'rgba(91, 75, 255, 0.10)',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  content: { flexGrow: 1, padding: 18, paddingBottom: 36, alignItems: 'center' },
  internalHeader: {
    width: '100%',
    maxWidth: 1100,
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
    marginLeft: 14,
    flex: 1,
  },
  internalHeaderEyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  internalHeaderTitle: {
    marginTop: 2,
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  internalHeaderSpacer: {
    width: 46,
    height: 46,
  },
  heroCard: {
    width: '100%',
    maxWidth: 1100,
    borderRadius: 28,
    marginBottom: 14,
    overflow: 'hidden',
    backgroundColor: '#FBF7FF',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.14)',
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  heroGradient: {
    padding: 20,
    borderRadius: 28,
    position: 'relative',
    backgroundColor: '#FBF7FF',
  },
  heroGlow: {
    position: 'absolute',
    right: -18,
    top: -18,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(91, 75, 255, 0.12)',
  },
  heroCopy: { maxWidth: '78%' },
  eyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 29,
    marginBottom: 8,
  },
  heroSubtitle: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  refreshText: { marginTop: 10, color: palette.primary, fontSize: 12, fontWeight: '800' },
  heroAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: palette.primary,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  heroActionText: { color: palette.surface, fontSize: 13, fontWeight: '800', marginLeft: 8 },
  metricGrid: { width: '100%', maxWidth: 1100, flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  metricCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricContent: { marginTop: 12 },
  metricValue: { fontSize: 22, fontWeight: '900' },
  metricLabel: { color: palette.ink, fontSize: 14, fontWeight: '700', marginTop: 2 },
  metricDescription: { color: palette.muted, fontSize: 12, marginTop: 4 },
  toolbar: {
    width: '100%',
    maxWidth: 1100,
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 12,
    marginBottom: 12,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: palette.wash,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchInput: { flex: 1, color: palette.ink, paddingHorizontal: 8, fontSize: 14, ...webInputReset },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  filter: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: palette.wash,
    borderWidth: 1,
    borderColor: palette.line,
  },
  filterActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  filterText: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  filterTextActive: {
    color: palette.surface,
  },
  loader: { marginVertical: 24 },
  errorCard: {
    width: '100%',
    maxWidth: 1100,
    backgroundColor: palette.dangerSoft,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(217, 87, 107, 0.25)',
    padding: 14,
    marginBottom: 12,
  },
  errorTitle: {
    color: palette.danger,
    fontWeight: '900',
    marginBottom: 4,
  },
  errorText: {
    color: palette.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    width: '100%',
    maxWidth: 1100,
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 20,
    marginBottom: 12,
  },
  emptyTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  emptyText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  formCard: {
    width: '100%',
    maxWidth: 1100,
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
    marginBottom: 14,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  formCardMuted: {
    opacity: 0.88,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  formIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  formMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formMarkLive: { backgroundColor: palette.successSoft },
  formMarkDraft: { backgroundColor: palette.warningSoft },
  formCopy: {
    flex: 1,
  },
  formTitle: {
    color: palette.ink,
    fontSize: 17,
    fontWeight: '900',
  },
  formSlug: {
    color: palette.muted,
    fontSize: 12,
    marginTop: 3,
    fontWeight: '700',
  },
  status: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '900',
  },
  description: {
    color: palette.muted,
    lineHeight: 20,
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  miniStat: {
    minWidth: 82,
    flexGrow: 1,
    backgroundColor: palette.wash,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  miniValue: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 15,
  },
  miniLabel: {
    color: palette.muted,
    fontSize: 11,
    marginTop: 3,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  action: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.wash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionStrong: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  actionDanger: {
    backgroundColor: 'rgba(217, 87, 107, 0.14)',
    borderColor: 'rgba(217, 87, 107, 0.28)',
  },
  actionText: {
    color: palette.ink,
    fontWeight: '900',
    fontSize: 12,
  },
  actionTextStrong: {
    color: palette.surface,
  },
  actionTextDanger: {
    color: palette.danger,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 18,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
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
    fontSize: 18,
    fontWeight: '900',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primarySoft,
  },
  modalText: {
    marginTop: 10,
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  qrCard: {
    marginTop: 14,
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  publicUrlLabel: {
    marginTop: 14,
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  publicUrlText: {
    marginTop: 6,
    color: palette.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryModalButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primarySoft,
    borderWidth: 1,
    borderColor: palette.line,
  },
  secondaryModalButtonText: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  primaryModalButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
  },
  primaryModalButtonText: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '900',
  },
});
