import React from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';

const appTheme = {
  page: '#F6F5FF',
  red: '#7657F7',
  muted: '#716C87',
  white: '#FFFFFF',
};

// Add error boundary for better error handling
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload();
      return;
    }

    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.errorScreen}>
            <View style={styles.errorCard}>
              <Text style={styles.errorEyebrow}>Application Error</Text>
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorMessage}>
                {this.state.error?.message || 'An unexpected error occurred'}
              </Text>
              {this.state.error?.stack ? (
                <ScrollView style={styles.stackWrap} nestedScrollEnabled>
                  <Text style={styles.stackText}>{this.state.error.stack}</Text>
                </ScrollView>
              ) : null}
              <Pressable style={styles.retryButton} onPress={this.handleRetry}>
                <Text style={styles.retryButtonText}>
                  {Platform.OS === 'web' ? 'Reload Application' : 'Try Again'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  return (
    <>
      <StatusBar
        style="dark"
        backgroundColor={appTheme.white}
        translucent={false}
      />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: appTheme.page,
  },
  errorScreen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: appTheme.page,
  },
  errorCard: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 24,
    padding: 24,
    backgroundColor: appTheme.white,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  errorEyebrow: {
    color: appTheme.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  errorTitle: {
    color: '#171429',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  errorMessage: {
    color: appTheme.muted,
    fontSize: 16,
    lineHeight: 22,
  },
  stackWrap: {
    maxHeight: 220,
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: '#F8F7FF',
    padding: 12,
  },
  stackText: {
    color: '#514B65',
    fontFamily: Platform.select({ web: 'monospace', default: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 20,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: appTheme.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  retryButtonText: {
    color: appTheme.white,
    fontSize: 16,
    fontWeight: '800',
  },
});
