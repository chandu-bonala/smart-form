import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { adminService } from '../../api/admin-service';
import { getErrorMessage } from '../../api/client';
import { User } from '../../context/types';
import { AdminStackParamList } from '../../navigation/NavigationTypes';
import { webInputReset } from '../../utils/webInputReset';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminUserDetail'>;

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

export const AdminUserDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { userId } = route.params;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await adminService.getUser(userId);
      setUser(data);
      setName(data.name);
      setEmail(data.email);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!user) return;
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      const updated = await adminService.updateUser(user.id, {
        name: name.trim(),
        email: email.trim(),
      });
      setUser(updated);
      setMessage('User updated.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const updated = await adminService.updateUserRole(user.id, user.role === 'admin' ? 'user' : 'admin');
      setUser(updated);
      setMessage('Role updated.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const updated = await adminService.updateUserStatus(user.id, !user.is_active);
      setUser(updated);
      setMessage('Status updated.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={palette.blue} />
          </View>
        ) : user ? (
          <>
            <View style={styles.hero}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user.name)}</Text>
              </View>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>Admin detail</Text>
                <Text style={styles.title}>{user.name}</Text>
                <Text style={styles.subtitle}>{user.email}</Text>
                <View style={styles.tagRow}>
                  <Tag label={user.role.toUpperCase()} tone={user.role === 'admin' ? 'amber' : 'blue'} />
                  <Tag label={user.is_active ? 'Active' : 'Disabled'} tone={user.is_active ? 'green' : 'red'} />
                  <Tag label={user.is_verified ? 'Verified' : 'Unverified'} tone={user.is_verified ? 'green' : 'red'} />
                </View>
              </View>
            </View>

            {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
            {message ? <View style={styles.successCard}><Text style={styles.successText}>{message}</Text></View> : null}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Profile</Text>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} />
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              <TouchableOpacity style={styles.primaryButton} onPress={save} disabled={saving} activeOpacity={0.9}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save changes</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Access</Text>
              <View style={styles.actions}>
                <ActionButton label={user.role === 'admin' ? 'Make user' : 'Make admin'} icon="shield" onPress={toggleRole} />
                <ActionButton label={user.is_active ? 'Disable' : 'Enable'} icon={user.is_active ? 'slash' : 'check-circle'} onPress={toggleStatus} danger={user.is_active} />
              </View>
            </View>

            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.9}>
              <Feather name="arrow-left" size={16} color={palette.blue} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const getInitials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const Tag: React.FC<{ label: string; tone: 'blue' | 'green' | 'amber' | 'red' }> = ({ label, tone }) => (
  <View style={[styles.tag, getTagStyle(tone)]}>
    <Text style={[styles.tagText, getTagTextStyle(tone)]}>{label}</Text>
  </View>
);

const ActionButton: React.FC<{ label: string; icon: any; onPress: () => void; danger?: boolean }> = ({ label, icon, onPress, danger }) => (
  <TouchableOpacity style={[styles.actionButton, danger ? styles.actionButtonDanger : null]} onPress={onPress} activeOpacity={0.9}>
    <Feather name={icon} size={14} color={danger ? '#fff' : palette.blue} />
    <Text style={[styles.actionButtonText, danger ? styles.actionButtonTextDanger : null]}>{label}</Text>
  </TouchableOpacity>
);

const getTagStyle = (tone: 'blue' | 'green' | 'amber' | 'red') => {
  if (tone === 'green') return styles.taggreen;
  if (tone === 'amber') return styles.tagamber;
  if (tone === 'red') return styles.tagred;
  return styles.tagblue;
};

const getTagTextStyle = (tone: 'blue' | 'green' | 'amber' | 'red') => {
  if (tone === 'green') return styles.tagTextgreen;
  if (tone === 'amber') return styles.tagTextamber;
  if (tone === 'red') return styles.tagTextred;
  return styles.tagTextblue;
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  container: { padding: 16, paddingBottom: 28, gap: 12 },
  loadingCard: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
  },
  hero: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: palette.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#ECE9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.blue,
    fontWeight: '900',
    fontSize: 18,
  },
  heroCopy: { flex: 1 },
  eyebrow: {
    color: palette.blue,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: { color: palette.ink, fontSize: 24, fontWeight: '900', marginTop: 4 },
  subtitle: { color: palette.muted, marginTop: 4, fontWeight: '600' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagblue: { backgroundColor: '#ECE9FF' },
  taggreen: { backgroundColor: '#E7FBF7' },
  tagamber: { backgroundColor: '#FFF6E6' },
  tagred: { backgroundColor: '#FFF0F3' },
  tagText: { fontSize: 11, fontWeight: '900' },
  tagTextblue: { color: palette.blue },
  tagTextgreen: { color: palette.green },
  tagTextamber: { color: palette.amber },
  tagTextred: { color: palette.red },
  errorCard: {
    backgroundColor: 'rgba(217, 87, 107, 0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(217, 87, 107, 0.22)',
    padding: 12,
  },
  successCard: {
    backgroundColor: '#E7FBF7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(21, 154, 138, 0.18)',
    padding: 12,
  },
  errorText: { color: palette.red, fontWeight: '700' },
  successText: { color: palette.green, fontWeight: '700' },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: 16,
  },
  cardTitle: { color: palette.ink, fontSize: 18, fontWeight: '900', marginBottom: 12 },
  fieldLabel: { color: palette.muted, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 10 },
  input: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F8F5FF',
    color: palette.ink,
    borderWidth: 0,
    ...webInputReset,
  },
  primaryButton: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: palette.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  actionButtonTextDanger: { color: '#fff' },
  backButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  backButtonText: { color: palette.blue, fontWeight: '900' },
});
