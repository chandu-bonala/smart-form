import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../../context/AuthContext';
import { getNameErrorMessage, getEmailErrorMessage, getPasswordErrorMessage } from '../../utils/validation';
import { GoogleAuthButton } from '../../components/GoogleAuthButton';
import { AuthStackParamList } from '../../navigation/NavigationTypes';
import { BrandMark } from '../../components/BrandMark';
import { webInputReset } from '../../utils/webInputReset';

type RegisterScreenProps = NativeStackScreenProps<AuthStackParamList, 'Register'>;

const palette = {
  primary: '#5b4bff',
  primaryLight: '#ECE9FF',
  white: '#FFFFFF',
  surface: 'rgba(255,255,255,0.96)',
  surfaceSoft: '#F8F7FF',
  text: '#171429',
  muted: '#716C87',
  border: 'rgba(227, 216, 255, 0.34)',
  error: '#D9576B',
  errorBg: '#FFF0F3',
  success: '#159A8A',
  successSoft: '#E7FBF7',
  shadow: 'rgba(15, 23, 42, 0.12)',
  primarySoft: 'rgba(91,75,255,0.08)',
};

const benefits = [
  { label: 'No friction', value: 'Start fast', icon: 'zap' as const },
  { label: 'Team ready', value: 'Invite safely', icon: 'users' as const },
  { label: 'Built in trust', value: 'Secure by default', icon: 'shield' as const },
];

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 920;
  const { register, isLoading, error, clearError, isAuthenticated } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const resetToAppStack = () => {
    const parent = navigation.getParent?.();
    const root = parent?.getParent?.() ?? parent;
    root?.reset?.({
      index: 0,
      routes: [{ name: 'AppStack' }],
    });
  };

  useEffect(() => {
    if (isAuthenticated) {
      resetToAppStack();
    }
  }, [isAuthenticated]);

  const validateForm = (): boolean => {
    let isValid = true;

    const nameErr = getNameErrorMessage(name);
    if (nameErr) {
      setNameError(nameErr);
      isValid = false;
    } else {
      setNameError('');
    }

    const emailErr = getEmailErrorMessage(email);
    if (emailErr) {
      setEmailError(emailErr);
      isValid = false;
    } else {
      setEmailError('');
    }

    const passwordErr = getPasswordErrorMessage(password);
    if (passwordErr) {
      setPasswordError(passwordErr);
      isValid = false;
    } else {
      setPasswordError('');
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    } else {
      setConfirmPasswordError('');
    }

    return isValid;
  };

  const handleRegister = async () => {
    clearError();
    setSuccessMessage('');
    if (!validateForm()) return;

    try {
      await register(name, email, password);
      setSuccessMessage('Account created successfully. Redirecting...');
      setTimeout(() => {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'AppStack' }],
          }),
        );
      }, 700);
    } catch (err) {
      console.error('Register error:', err);
    }
  };

  return (
    <ImageBackground source={require('../../../assets/landing-background.png')} resizeMode="cover" style={styles.background}>
      <StatusBar style="dark" />
      <View style={styles.overlay}>
        <View style={styles.orbOne} />
        <View style={styles.orbTwo} />
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.layout, isWide ? styles.layoutWide : styles.layoutStack]}>
                <View style={styles.heroPanel}>
                  <BrandMark size={56} showLabel labelColor={palette.text} />
                  <View style={styles.heroBadge}>
                    <Feather name="user-plus" size={14} color={palette.primary} />
                    <Text style={styles.heroBadgeText}>Create your account</Text>
                  </View>
                  <Text style={styles.heroTitle}>Create your workspace and start building in minutes.</Text>
                  <Text style={styles.heroCopy}>
                    Capture responses, guide follow-ups, and keep your forms organized from one tidy place.
                  </Text>
                  <View style={styles.benefits}>
                    {benefits.map((item) => (
                      <View key={item.label} style={styles.benefitCard}>
                        <View style={styles.benefitIcon}>
                          <Feather name={item.icon} size={16} color={palette.primary} />
                        </View>
                        <Text style={styles.benefitValue}>{item.value}</Text>
                        <Text style={styles.benefitLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.formPanel}>
                  <View style={styles.formCard}>
                    <View style={styles.formTop}>
                      <View>
                        <Text style={styles.formEyebrow}>Sign up</Text>
                        <Text style={styles.formTitle}>Create account</Text>
                        <Text style={styles.formSubtitle}>Use Google or fill in the details below.</Text>
                      </View>
                      <View style={styles.formBadge}>
                        <Feather name="user-plus" size={16} color={palette.primary} />
                      </View>
                    </View>

                    {error ? (
                      <View style={styles.errorCard}>
                        <Text style={styles.errorText}>{error}</Text>
                      </View>
                    ) : null}

                    {successMessage ? (
                      <View style={styles.successCard}>
                        <Text style={styles.successText}>{successMessage}</Text>
                      </View>
                    ) : null}

                    <GoogleAuthButton disabled={isLoading} />

                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>or continue with email</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Full name</Text>
                      <View style={[styles.inputShell, nameError ? styles.inputShellError : null]}>
                        <Feather name="user" size={18} color={nameError ? palette.error : palette.muted} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Your name"
                          placeholderTextColor="#5EA0FF"
                          value={name}
                          onChangeText={(text) => {
                            setName(text);
                            if (nameError) setNameError('');
                            if (error) clearError();
                          }}
                          autoCapitalize="words"
                          editable={!isLoading}
                        />
                      </View>
                      {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Email</Text>
                      <View style={[styles.inputShell, emailError ? styles.inputShellError : null]}>
                        <Feather name="mail" size={18} color={emailError ? palette.error : palette.muted} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="you@example.com"
                          placeholderTextColor="#5EA0FF"
                          value={email}
                          onChangeText={(text) => {
                            setEmail(text);
                            if (emailError) setEmailError('');
                            if (error) clearError();
                          }}
                          keyboardType="email-address"
                          autoComplete="email"
                          autoCapitalize="none"
                          editable={!isLoading}
                        />
                      </View>
                      {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Password</Text>
                      <View style={[styles.inputShell, passwordError ? styles.inputShellError : null]}>
                        <Feather name="key" size={18} color={passwordError ? palette.error : palette.muted} style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Create a password"
                          placeholderTextColor="#5EA0FF"
                          value={password}
                          onChangeText={(text) => {
                            setPassword(text);
                            if (passwordError) setPasswordError('');
                            if (error) clearError();
                          }}
                          secureTextEntry={!showPassword}
                          autoComplete="new-password"
                          autoCapitalize="none"
                          editable={!isLoading}
                        />
                        <TouchableOpacity onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton}>
                          <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={palette.muted} />
                        </TouchableOpacity>
                      </View>
                      {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
                    </View>

                    <View style={styles.field}>
                      <Text style={styles.label}>Confirm password</Text>
                      <View style={[styles.inputShell, confirmPasswordError ? styles.inputShellError : null]}>
                        <Feather
                          name="lock"
                          size={18}
                          color={confirmPasswordError ? palette.error : palette.muted}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Re-enter your password"
                          placeholderTextColor="#5EA0FF"
                          value={confirmPassword}
                          onChangeText={(text) => {
                            setConfirmPassword(text);
                            if (confirmPasswordError) setConfirmPasswordError('');
                            if (error) clearError();
                          }}
                          secureTextEntry={!showConfirmPassword}
                          autoComplete="new-password"
                          autoCapitalize="none"
                          editable={!isLoading}
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPassword((value) => !value)} style={styles.eyeButton}>
                          <Feather name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color={palette.muted} />
                        </TouchableOpacity>
                      </View>
                      {confirmPasswordError ? <Text style={styles.fieldError}>{confirmPasswordError}</Text> : null}
                    </View>

                    <View style={styles.requirementsCard}>
                      <Text style={styles.requirementsTitle}>Password checklist</Text>
                      <Requirement met={password.length >= 8} text="8+ characters" />
                      <Requirement met={/[A-Z]/.test(password)} text="Uppercase letter" />
                      <Requirement met={/[a-z]/.test(password)} text="Lowercase letter" />
                      <Requirement met={/[0-9]/.test(password)} text="Number" />
                    </View>

                    <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} disabled={isLoading} activeOpacity={0.9}>
                      {isLoading ? (
                        <ActivityIndicator color={palette.white} />
                      ) : (
                        <>
                          <Text style={styles.primaryButtonText}>Create account</Text>
                          <Feather name="arrow-right" size={18} color={palette.white} />
                        </>
                      )}
                    </TouchableOpacity>

                    <View style={styles.footer}>
                      <Text style={styles.footerText}>Already have an account?</Text>
                      <TouchableOpacity onPress={() => navigation.replace('Login')}>
                        <Text style={styles.link}>Sign in</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </ImageBackground>
  );
};

const Requirement: React.FC<{ text: string; met: boolean }> = ({ text, met }) => (
  <View style={styles.requirement}>
    <Feather name={met ? 'check' : 'x'} size={16} color={met ? palette.success : palette.error} />
    <Text style={[styles.requirementText, { color: met ? palette.success : palette.error }]}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(255,255,255,0.56)' },
  safeArea: { flex: 1 },
  container: { flex: 1 },
  orbOne: {
    position: 'absolute',
    top: -72,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(118, 87, 247, 0.12)',
  },
  orbTwo: {
    position: 'absolute',
    bottom: 60,
    left: -72,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(78, 132, 244, 0.10)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  layout: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: 20,
  },
  layoutWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  layoutStack: {
    flexDirection: 'column',
  },
  heroPanel: {
    flex: 1,
    borderRadius: 30,
    padding: 28,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(91, 132, 244, 0.18)',
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 6,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: palette.primarySoft,
    borderWidth: 0,
  },
  heroBadgeText: {
    marginLeft: 6,
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    color: palette.text,
    fontSize: 40,
    lineHeight: 45,
    fontWeight: '900',
    marginTop: 16,
    maxWidth: 430,
  },
  heroCopy: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 430,
    marginTop: 14,
  },
  benefits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
  },
  benefitCard: {
    minWidth: 138,
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 0,
  },
  benefitIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: palette.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitValue: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  benefitLabel: {
    color: palette.muted,
    fontSize: 12,
  },
  formPanel: {
    flex: 1,
  },
  formCard: {
    borderRadius: 30,
    padding: 26,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(91, 132, 244, 0.18)',
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.22,
    shadowRadius: 30,
    elevation: 12,
  },
  formTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  formEyebrow: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  formTitle: {
    color: palette.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    marginBottom: 8,
  },
  formSubtitle: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 280,
  },
  formBadge: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: palette.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: palette.errorBg,
    borderWidth: 0,
    marginBottom: 14,
  },
  errorText: { color: palette.error, fontSize: 13, fontWeight: '700' },
  successCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: palette.successSoft,
    borderWidth: 0,
    marginBottom: 14,
  },
  successText: { color: palette.success, fontSize: 13, fontWeight: '700' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: palette.border,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: palette.muted,
    fontWeight: '700',
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.14)',
    backgroundColor: palette.surfaceSoft,
    minHeight: 52,
    paddingHorizontal: 14,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  inputShellError: {
    backgroundColor: '#FFF7F8',
    borderColor: 'rgba(91, 75, 255, 0.22)',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    paddingVertical: 12,
    borderWidth: 0,
    ...webInputReset,
  },
  eyeButton: {
    marginLeft: 10,
    padding: 4,
  },
  fieldError: {
    color: palette.error,
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  requirementsCard: {
    backgroundColor: palette.surfaceSoft,
    borderRadius: 18,
    borderWidth: 0,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  requirementsTitle: {
    color: palette.text,
    fontWeight: '900',
    marginBottom: 10,
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: 'rgba(91, 75, 255, 0.35)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 8,
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '900',
    marginRight: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 6,
  },
  footerText: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  link: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '900',
  },
});
