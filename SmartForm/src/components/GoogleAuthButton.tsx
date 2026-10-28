import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../context/AuthContext';
import { Feather } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

const DEFAULT_GOOGLE_WEB_CLIENT_ID = '344811018739-fsu59s1mqc2ndmrqs6iepjebts1k23gm.apps.googleusercontent.com';
const COLORS = {
  PRIMARY: '#5b4bff',
  WHITE: '#FFFFFF',
  GRAY_50: '#F8F7FF',
  GRAY_200: 'rgba(227, 216, 255, 0.38)',
  GRAY_400: '#A09BB6',
  GRAY_900: '#171429',
  SHADOW: 'rgba(15, 23, 42, 0.12)',
};

const googleWebClientId =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID ||
  DEFAULT_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';

interface GoogleAuthButtonProps {
  disabled?: boolean;
  label?: string;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  disabled = false,
  label = 'Continue with Google',
}) => {
  const { loginWithGoogle } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!googleWebClientId) {
    console.warn('Google web client id is missing. Check SmartForm/.env.');
  }

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      clientId: googleWebClientId,
      webClientId: googleWebClientId,
      iosClientId: googleIosClientId || undefined,
      androidClientId: googleAndroidClientId || undefined,
      selectAccount: true,
    },
  );

  useEffect(() => {
    const exchangeGoogleToken = async () => {
      if (!response || response.type !== 'success') return;

      const idToken = response.params?.id_token;
      if (!idToken) {
        Alert.alert('Google sign-in failed', 'Google did not return an ID token.');
        setIsSubmitting(false);
        return;
      }

      try {
        await loginWithGoogle(idToken);
      } catch (error) {
        Alert.alert('Google sign-in failed', error instanceof Error ? error.message : 'Could not complete sign in.');
      } finally {
        setIsSubmitting(false);
      }
    };

    void exchangeGoogleToken();
  }, [loginWithGoogle, response]);

  const handlePress = async () => {
    if (disabled || isSubmitting || !request) return;

    setIsSubmitting(true);
    try {
      const result = await promptAsync();
      if (result.type === 'dismiss' || result.type === 'cancel') {
        setIsSubmitting(false);
      }
    } catch (error) {
      setIsSubmitting(false);
      Alert.alert('Google sign-in failed', error instanceof Error ? error.message : 'Unable to start Google sign in.');
    }
  };

  return (
    <GoogleButtonShell
      disabled={disabled || isSubmitting || !request}
      label={label}
      loading={isSubmitting}
      onPress={handlePress}
    />
  );
};

interface GoogleButtonShellProps {
  disabled: boolean;
  loading?: boolean;
  label: string;
  onPress: () => void;
}

const GoogleButtonShell: React.FC<GoogleButtonShellProps> = ({ disabled, loading = false, label, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.button, disabled ? styles.buttonDisabled : null]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.88}
    >
      <View style={styles.googleMark}>
        {loading ? (
          <ActivityIndicator size="small" color="#4285F4" />
        ) : (
          <Text style={styles.googleMarkText}>G</Text>
        )}
      </View>
      <Text style={styles.buttonText}>{label}</Text>
      <Feather name="arrow-right" size={16} color={COLORS.GRAY_400} style={styles.chevron} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 0,
    paddingHorizontal: 18,
    marginBottom: 12,
    shadowColor: COLORS.SHADOW,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: COLORS.GRAY_900,
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  googleMark: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.GRAY_50,
    borderWidth: 0,
    marginRight: 10,
  },
  googleMarkText: {
    color: '#4285F4',
    fontSize: 15,
    fontWeight: '900',
  },
  chevron: {
    marginLeft: 8,
  },
});
