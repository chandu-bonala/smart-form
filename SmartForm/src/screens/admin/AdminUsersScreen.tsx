import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { adminService } from '../../api/admin-service';
import { getErrorMessage } from '../../api/client';
import { User } from '../../context/types';
import { AdminStackParamList } from '../../navigation/NavigationTypes';
import { webInputReset } from '../../utils/webInputReset';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminUsers'>;

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

export const AdminUsersScreen: React.FC<Props> = ({ navigation }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const response = await adminService.listUsers(search ? { search } : undefined);
      setUsers(response.items);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    return {
      admins: users.filter((user) => user.role === 'admin').length,
      active: users.filter((user) => user.is_active).length,
    };
  }, [users]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleToggleActive = async (user: User) => {
    try {
      setSavingId(user.id);
      const updated = await adminService.updateUserStatus(user.id, !user.is_active);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleRole = async (user: User) => {
    try {
      setSavingId(user.id);
      const nextRole = user.role === 'admin' ? 'user' : 'admin';
      const updated = await adminService.updateUserRole(user.id, nextRole);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[palette.blue]} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>People</Text>
            <Text style={styles.title}>User management</Text>
            <Text style={styles.subtitle}>Review accounts and move people between admin and user access.</Text>
          </View>
          <View style={styles.headerStats}>
            <Chip label="Admins" value={summary.admins} />
            <Chip label="Active" value={summary.active} />
          </View>
        </View>

        <View style={styles.searchCard}>
          <Feather name="search" size={16} color={palette.muted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={load}
            placeholder="Search users"
            placeholderTextColor="#5EA0FF"
          />
          <TouchableOpacity style={styles.searchButton} onPress={load} activeOpacity={0.85}>
            <Text style={styles.searchButtonText}>Go</Text>
          </TouchableOpacity>
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
          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <View style={styles.userTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
                </View>
                <View style={styles.userCopy}>
                  <Text style={styles.userName}>{user.name}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <View style={styles.tagRow}>
                    <StatusTag label={user.role.toUpperCase()} tone={user.role === 'admin' ? 'amber' : 'blue'} />
                    <StatusTag label={user.is_active ? 'Active' : 'Disabled'} tone={user.is_active ? 'green' : 'red'} />
                    <StatusTag label={user.is_verified ? 'Verified' : 'Unverified'} tone={user.is_verified ? 'green' : 'red'} />
                  </View>
                </View>
              </View>

              <View style={styles.actions}>
                <ActionButton label="Detail" icon="user" onPress={() => navigation.navigate('AdminUserDetail', { userId: user.id })} />
                <ActionButton
                  label={user.role === 'admin' ? 'Make user' : 'Make admin'}
                  icon="shield"
                  onPress={() => handleToggleRole(user)}
                  disabled={savingId === user.id}
                />
                <ActionButton
                  label={user.is_active ? 'Disable' : 'Enable'}
                  icon={user.is_active ? 'slash' : 'check-circle'}
                  onPress={() => handleToggleActive(user)}
                  disabled={savingId === user.id}
                  danger={user.is_active}
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getInitials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const Chip: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={styles.chip}>
    <Text style={styles.chipValue}>{value}</Text>
    <Text style={styles.chipLabel}>{label}</Text>
  </View>
);

const StatusTag: React.FC<{ label: string; tone: 'blue' | 'green' | 'amber' | 'red' }> = ({ label, tone }) => (
  <View style={[styles.statusTag, getToneStyle(tone)]}>
    <Text style={[styles.statusText, getToneTextStyle(tone)]}>{label}</Text>
  </View>
);

const ActionButton: React.FC<{ label: string; icon: any; onPress: () => void; disabled?: boolean; danger?: boolean }> = ({
  label,
  icon,
  onPress,
  disabled,
  danger,
}) => (
  <TouchableOpacity
    style={[styles.actionButton, danger ? styles.actionButtonDanger : null, disabled ? { opacity: 0.5 } : null]}
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.9}
  >
    <Feather name={icon} size={14} color={danger ? '#fff' : palette.blue} />
    <Text style={[styles.actionButtonText, danger ? styles.actionButtonTextDanger : null]}>{label}</Text>
  </TouchableOpacity>
);

const getToneStyle = (tone: 'blue' | 'green' | 'amber' | 'red') => {
  if (tone === 'green') return styles.statusgreen;
  if (tone === 'amber') return styles.statusamber;
  if (tone === 'red') return styles.statusred;
  return styles.statusblue;
};

const getToneTextStyle = (tone: 'blue' | 'green' | 'amber' | 'red') => {
  if (tone === 'green') return styles.statusTextgreen;
  if (tone === 'amber') return styles.statusTextamber;
  if (tone === 'red') return styles.statusTextred;
  return styles.statusTextblue;
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
    maxWidth: 560,
    fontWeight: '600',
  },
  headerStats: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  chip: {
    minWidth: 92,
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  chipValue: {
    color: palette.blue,
    fontSize: 18,
    fontWeight: '900',
  },
  chipLabel: {
    color: palette.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 10,
    color: palette.ink,
    ...webInputReset,
  },
  searchButton: {
    backgroundColor: palette.blue,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  searchButtonText: { color: '#fff', fontWeight: '800' },
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
  userCard: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 14,
  },
  userTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#ECE9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.blue,
    fontWeight: '900',
  },
  userCopy: { flex: 1 },
  userName: { color: palette.ink, fontWeight: '900', fontSize: 16 },
  userEmail: { color: palette.muted, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  statusTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusblue: { backgroundColor: '#ECE9FF' },
  statusgreen: { backgroundColor: '#E7FBF7' },
  statusamber: { backgroundColor: '#FFF6E6' },
  statusred: { backgroundColor: '#FFF0F3' },
  statusText: { fontSize: 11, fontWeight: '900' },
  statusTextblue: { color: palette.blue },
  statusTextgreen: { color: palette.green },
  statusTextamber: { color: palette.amber },
  statusTextred: { color: palette.red },
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
  actionButtonDanger: {
    backgroundColor: palette.red,
    borderColor: palette.red,
  },
  actionButtonText: {
    color: palette.blue,
    marginLeft: 6,
    fontWeight: '800',
    fontSize: 12,
  },
  actionButtonTextDanger: {
    color: '#fff',
  },
});
