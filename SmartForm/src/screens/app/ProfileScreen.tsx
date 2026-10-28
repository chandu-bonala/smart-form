import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { AppStackParamList } from '../../navigation/NavigationTypes';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../api/client';
import { usersService } from '../../api/users-service';
import { BASE_URL } from '../../constants/api';
import { webInputReset } from '../../utils/webInputReset';

const ui = {
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

const toText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).join(' • ');
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    if (typeof record.detail === 'string') return record.detail;
    if (typeof record.msg === 'string') return record.msg;
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
};

type ProfileScreenProps = NativeStackScreenProps<AppStackParamList, 'Profile'>;

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, logout, setAuthenticatedUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.profile_image ?? null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setAvatarUri(user.profile_image ?? null);
    }
  }, [user]);

  const avatarSourceUri = useMemo(() => {
    if (!avatarUri) return null;
    if (avatarUri.startsWith('http://') || avatarUri.startsWith('https://') || avatarUri.startsWith('data:')) {
      return avatarUri;
    }
    return `${BASE_URL}${avatarUri}`;
  }, [avatarUri]);

  const initials = useMemo(() => {
    const base = name || email || 'U';
    const parts = base.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return base.slice(0, 2).toUpperCase();
  }, [name, email]);

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || (result as any).cancelled) {
      return;
    }

    const asset = Array.isArray((result as any).assets) ? (result as any).assets[0] : null;
    if (!asset?.uri) {
      return;
    }

    try {
      setUploadingAvatar(true);
      setError(null);
      setMessage(null);

      const updatedUser = await usersService.uploadAvatar(
        asset.uri,
        asset.fileName || `avatar-${Date.now()}.jpg`,
        asset.mimeType || 'image/jpeg',
      );

      setAvatarUri(updatedUser.profile_image ?? null);
      await setAuthenticatedUser(updatedUser);
      setMessage('Profile photo updated.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const updatedUser = await usersService.updateMe({
        name: name.trim(),
        email: email.trim(),
      });

      await setAuthenticatedUser(updatedUser);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSendVerification = async () => {
    try {
      setSendingCode(true);
      setError(null);
      setMessage(null);
      const response = await usersService.sendEmailVerification();
      setMessage(toText(response.message) || 'Verification code sent.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!otpCode.trim()) {
      setError('Enter the verification code sent to your email.');
      return;
    }

    try {
      setVerifying(true);
      setError(null);
      setMessage(null);
      const updatedUser = await usersService.verifyEmail(otpCode.trim());
      await setAuthenticatedUser(updatedUser);
      setOtpCode('');
      setMessage('Email verified successfully.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.backgroundLayer} pointerEvents="none">
          <View style={styles.bgGlowOne} />
          <View style={styles.bgGlowTwo} />
          <View style={styles.bgGlowThree} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.shell}>
            <View style={styles.internalHeader}>
              <TouchableOpacity style={styles.backButton} activeOpacity={0.86} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'))}>
                <Feather name="arrow-left" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.internalHeaderCopy}>
                <Text style={styles.screenEyebrow}>Account settings</Text>
                <Text style={styles.screenTitle}>Profile</Text>
              </View>
              <View style={styles.headerChip}>
                <Feather name={user?.is_verified ? 'check-circle' : 'clock'} size={14} color={user?.is_verified ? ui.green : ui.amber} />
                <Text style={[styles.headerChipText, user?.is_verified ? styles.headerChipTextVerified : styles.headerChipTextPending]}>
                  {user?.is_verified ? 'Verified' : 'Pending'}
                </Text>
              </View>
            </View>

            <View style={styles.pageHeader}>
              <Text style={styles.pageSubtitle}>Keep your details polished and verified so the workspace reflects the right account.</Text>
            </View>

            <LinearGradient colors={['rgba(8,17,45,0.02)', 'rgba(18,43,111,0.02)', 'rgba(109,40,217,0.02)']} style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>Workspace identity</Text>
                  <Text style={styles.heroTitle}>{user?.name || 'Your profile'}</Text>
                  <Text style={styles.heroSubtitle}>A calmer, clearer home for your account identity, verification, and profile actions.</Text>
                </View>
                <View style={styles.heroBadge}>
                  <Feather name={user?.is_verified ? 'check-circle' : 'clock'} size={12} color={user?.is_verified ? ui.green : ui.amber} />
                  <Text style={styles.heroBadgeText}>{user?.is_verified ? 'Verified' : 'Pending'}</Text>
                </View>
              </View>

              <View style={styles.heroProfileRow}>
                <TouchableOpacity style={styles.avatarButton} activeOpacity={0.9} onPress={handlePickAvatar} disabled={uploadingAvatar}>
                  {avatarSourceUri ? (
                    <Image source={{ uri: avatarSourceUri }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>{initials}</Text>
                    </View>
                  )}
                  <View style={styles.avatarOverlay}>
                    {uploadingAvatar ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="camera" size={16} color="#fff" />}
                  </View>
                </TouchableOpacity>

                <View style={styles.heroMeta}>
                  <Text style={styles.heroName}>{user?.name || 'Unknown user'}</Text>
                  <Text style={styles.heroEmail}>{user?.email || 'No email available'}</Text>
                  <Text style={styles.heroRole}>{(user?.role || 'user').toUpperCase()}</Text>
                </View>
              </View>
            </LinearGradient>

            {error ? (
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>{toText(error)}</Text>
              </View>
            ) : null}
            {message ? (
              <View style={[styles.alertBox, styles.successBox]}>
                <Text style={styles.successText}>{toText(message)}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Profile details</Text>
                  <Text style={styles.sectionSubtitle}>Edit the identity shown across your workspace.</Text>
                </View>
                <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9} onPress={handleSave}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Save</Text>}
                </TouchableOpacity>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#5EA0FF"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#5EA0FF"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.helperRow}>
                <Feather name="upload-cloud" size={16} color={ui.blue} />
                <Text style={styles.helperText}>Tap the avatar to upload a new photo from your device.</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Email verification</Text>
                  <Text style={styles.sectionSubtitle}>Confirm your mailbox so account recovery stays reliable.</Text>
                </View>
              </View>

              <View style={styles.verifyRow}>
                {user?.is_verified ? (
                  <View style={styles.verifiedPill}>
                    <Feather name="check-circle" size={16} color={ui.green} />
                    <Text style={styles.verifiedPillText}>Verified</Text>
                  </View>
                ) : (
                  <View style={styles.pendingPill}>
                    <Feather name="clock" size={16} color={ui.amber} />
                    <Text style={styles.pendingPillText}>Not verified yet</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9} onPress={handleSendVerification}>
                {sendingCode ? <ActivityIndicator color={ui.blue} size="small" /> : <Text style={styles.secondaryButtonText}>Send verification code</Text>}
              </TouchableOpacity>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Verification code</Text>
                <TextInput
                  value={otpCode}
                  onChangeText={setOtpCode}
                  style={styles.input}
                  placeholder="Enter the 6-digit code"
                  placeholderTextColor="#5EA0FF"
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.9} onPress={handleVerifyEmail}>
                {verifying ? <ActivityIndicator color={ui.blue} size="small" /> : <Text style={styles.secondaryButtonText}>Verify email</Text>}
              </TouchableOpacity>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.navButton} activeOpacity={0.9} onPress={() => navigation.navigate('FormsList')}>
                <Feather name="file-text" size={16} color={ui.blue} />
                <Text style={styles.navButtonText}>My forms</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navButton, styles.navButtonDanger]} activeOpacity={0.9} onPress={handleLogout}>
                <Feather name="log-out" size={16} color="#fff" />
                <Text style={[styles.navButtonText, styles.navButtonTextDanger]}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F5FF',
  },
  screen: {
    flex: 1,
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
  container: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    alignItems: 'center',
  },
  internalHeader: {
    width: '100%',
    maxWidth: 980,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    padding: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.14)',
    shadowColor: 'rgba(91, 75, 255, 0.10)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 10,
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
  screenEyebrow: {
    color: ui.blue,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  screenTitle: {
    color: ui.ink,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  shell: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
  },
  pageHeader: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 28,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.14)',
  },
  pageSubtitle: {
    color: ui.muted,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    backgroundColor: '#FBF7FF',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.14)',
    shadowColor: 'rgba(15, 23, 42, 0.08)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  heroCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: ui.blue,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: ui.ink,
  },
  heroSubtitle: {
    fontSize: 13,
    color: ui.muted,
    marginTop: 6,
    lineHeight: 20,
  },
  heroBadge: {
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
  },
  heroBadgeText: {
    color: ui.blue,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },
  heroProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarButton: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
  },
  avatarFallbackText: {
    color: ui.blue,
    fontSize: 24,
    fontWeight: '800',
  },
  avatarOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ui.blue,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(15, 23, 42, 0.18)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  heroMeta: {
    flex: 1,
  },
  heroName: {
    fontSize: 18,
    fontWeight: '700',
    color: ui.ink,
  },
  heroEmail: {
    fontSize: 13,
    color: ui.muted,
    marginTop: 4,
  },
  heroRole: {
    fontSize: 11,
    color: ui.blue,
    marginTop: 6,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  card: {
    backgroundColor: '#FBF7FF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.14)',
    shadowColor: 'rgba(15, 23, 42, 0.06)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: ui.ink,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: ui.muted,
    marginTop: 3,
  },
  primaryButton: {
    backgroundColor: '#5B4BFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  fieldGroup: {
    marginTop: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: ui.muted,
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: ui.ink,
    backgroundColor: '#F8F5FF',
    borderWidth: 0,
    ...webInputReset,
  },
  helperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#F4EEFF',
    borderRadius: 12,
    padding: 10,
  },
  helperText: {
    fontSize: 12,
    color: ui.ink,
    marginLeft: 8,
    flex: 1,
  },
  verifyRow: {
    marginBottom: 10,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ui.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  verifiedPillText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: ui.green,
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ui.amberSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  pendingPillText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: ui.amber,
  },
  secondaryButton: {
    backgroundColor: ui.surfaceSoft,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: ui.blue,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ui.surface,
    borderRadius: 16,
    paddingVertical: 12,
    marginRight: 8,
    shadowColor: 'rgba(15, 23, 42, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  navButtonDanger: {
    marginRight: 0,
    marginLeft: 8,
    backgroundColor: ui.red,
  },
  navButtonText: {
    color: ui.ink,
    fontWeight: '700',
    marginLeft: 8,
  },
  navButtonTextDanger: {
    color: '#fff',
  },
  alertBox: {
    backgroundColor: ui.redSoft,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  successBox: {
    backgroundColor: ui.greenSoft,
  },
  alertText: {
    color: ui.red,
    fontSize: 13,
    fontWeight: '600',
  },
  successText: {
    color: ui.green,
    fontSize: 13,
    fontWeight: '600',
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
  },
  headerChipText: {
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },
  headerChipTextVerified: {
    color: ui.green,
  },
  headerChipTextPending: {
    color: ui.amber,
  },
});

export default ProfileScreen;
