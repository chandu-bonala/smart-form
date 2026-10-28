import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppStackParamList } from '../../navigation/NavigationTypes';
import { useAuth } from '../../context/AuthContext';
import { formsService } from '../../api/forms-service';
import { getErrorMessage } from '../../api/client';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { webInputReset } from '../../utils/webInputReset';

const palette = {
  primary: '#5b4bff',
  secondary: '#2ea6ff',
  accent: '#7c3aed',
  white: '#FFFFFF',
  surface: 'rgba(255,255,255,0.96)',
  muted: '#6b7280',
  text: '#172033',
  border: '#e7ebf6',
  cardBorder: 'rgba(91, 75, 255, 0.14)',
  error: '#ef4444',
  errorBg: 'rgba(239, 68, 68, 0.1)',
  success: '#34c759',
  background: '#f5f8ff',
  shadow: 'rgba(15, 23, 42, 0.12)',
};

const BUILT_IN_TEMPLATES = [
  {
    title: 'Student Registration',
    description: 'Collect personal details, course details, and contact information.',
  },
  {
    title: 'School Admission',
    description: 'Capture student data, parent details, academics, and document uploads.',
  },
  {
    title: 'Job Application',
    description: 'Screen candidates with skills, experience, and availability questions.',
  },
  {
    title: 'Event Registration',
    description: 'Register attendees, gather preferences, and collect logistics info.',
  },
  {
    title: 'Course Signup',
    description: 'Let learners enroll with goals, level, and schedule preferences.',
  },
  {
    title: 'Customer Feedback',
    description: 'Gather ratings, comments, and suggestions for improvement.',
  },
] as const;

export const FormCreateScreen: React.FC<NativeStackScreenProps<AppStackParamList, 'FormCreate'>> = ({ navigation, route }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState(route.params?.template?.title ?? '');
  const [description, setDescription] = useState(route.params?.template?.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readyScore = [title.trim(), description.trim()].filter(Boolean).length;

  const applyTemplate = (template: (typeof BUILT_IN_TEMPLATES)[number]) => {
    setTitle(template.title);
    setDescription(template.description);
    setError(null);
  };

  const handleCreate = async () => {
    if (!user) {
      return;
    }

    if (!title.trim()) {
      setError('Please provide a form title.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const form = await formsService.create({
        owner_id: user.id,
        title: title.trim(),
        description: description.trim() || undefined,
        status: 'draft',
      });
      navigation.replace('FormDetail', { formId: form.id });
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      Alert.alert('Create form failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={['#FDFDFF', '#F3F7FF', '#F7F0FF']} style={styles.background}>
        <View style={styles.backgroundGlowOne} />
        <View style={styles.backgroundGlowTwo} />
        <View style={styles.backgroundGlowThree} />
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.internalHeader}>
            <TouchableOpacity style={styles.backButton} activeOpacity={0.86} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('FormsList'))}>
              <Feather name="arrow-left" size={18} color={palette.primary} />
            </TouchableOpacity>
            <View style={styles.internalHeaderCopy}>
              <Text style={styles.screenEyebrow}>Form studio</Text>
              <Text style={styles.screenTitle}>Create Form</Text>
            </View>
            <View style={styles.headerPill}>
              <Feather name="edit-3" size={14} color={palette.primary} />
              <Text style={styles.headerPillText}>Draft setup</Text>
            </View>
          </View>
          <View style={styles.heroCard}>
            <LinearGradient colors={['rgba(255,255,255,0.92)', 'rgba(245,248,255,0.88)', 'rgba(245,240,255,0.90)']} style={styles.heroGradient}>
              <View style={styles.heroGlow} />
              <View style={styles.heroIcon} accessible accessibilityRole="image" accessibilityLabel="Create form icon">
                <Feather name="plus-circle" size={40} color={palette.primary} />
              </View>
              <Text style={styles.eyebrow}>Form studio</Text>
              <Text style={styles.title}>Start with the clean essentials</Text>
              <Text style={styles.subtitle}>
                Start with one of six built-in templates or write your own form brief, then jump into the builder to add questions, rules, and analytics.
              </Text>
            </LinearGradient>
          </View>

          <View style={styles.templateSection}>
            <View style={styles.templateSectionHeader}>
              <View>
                <Text style={styles.templateEyebrow}>Built-in templates</Text>
                <Text style={styles.templateTitle}>6 usable starters</Text>
              </View>
              <View style={styles.templatePill}>
                <Feather name="layers" size={14} color={palette.primary} />
                <Text style={styles.templatePillText}>Quick start</Text>
              </View>
            </View>
            <View style={styles.templateGrid}>
              {BUILT_IN_TEMPLATES.map((template) => (
                <TouchableOpacity
                  key={template.title}
                  style={styles.templateCard}
                  activeOpacity={0.88}
                  onPress={() => applyTemplate(template)}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${template.title} template`}
                >
                  <View style={styles.templateIcon}>
                    <Feather name="file-text" size={16} color={palette.primary} />
                  </View>
                  <Text style={styles.templateCardTitle}>{template.title}</Text>
                  <Text style={styles.templateCardText}>{template.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {error ? (
            <View style={styles.errorCard}>
              <View style={styles.errorHeader}>
                <Feather name="alert-circle" size={18} color={palette.error} />
                <Text style={styles.errorTitle}>Something went wrong</Text>
              </View>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Form Brief</Text>
              <View style={styles.readyPill}>
                <Text style={styles.readyPillText}>{readyScore}/2 ready</Text>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Form title</Text>
              <TextInput
                style={styles.input}
                placeholder="Customer feedback"
                placeholderTextColor="#5EA0FF"
                value={title}
                onChangeText={setTitle}
                editable={!loading}
                accessible
                accessibilityLabel="Form title input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell respondents what this form is for"
                placeholderTextColor="#5EA0FF"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                editable={!loading}
                accessible
                accessibilityLabel="Form description input"
              />
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => navigation.goBack()}
              disabled={loading}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Cancel and go back"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createButton, loading && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={loading}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel="Create form"
            >
              {loading ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <View style={styles.createButtonContent}>
                  <Feather name="check" size={16} color={palette.white} />
                  <Text style={styles.createButtonText}>Create Form</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  background: {
    flex: 1,
    position: 'relative',
  },
  backgroundGlowOne: {
    position: 'absolute',
    top: -70,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(91, 75, 255, 0.18)',
  },
  backgroundGlowTwo: {
    position: 'absolute',
    top: 120,
    right: -110,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(46, 166, 255, 0.14)',
  },
  backgroundGlowThree: {
    position: 'absolute',
    bottom: -120,
    left: '15%',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(168, 111, 255, 0.10)',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 32,
    alignItems: 'center',
  },
  internalHeader: {
    width: '100%',
    maxWidth: 860,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    padding: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: palette.cardBorder,
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
    borderColor: palette.cardBorder,
  },
  internalHeaderCopy: {
    flex: 1,
    paddingHorizontal: 14,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerPillText: {
    marginLeft: 6,
    color: palette.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  screenEyebrow: { color: palette.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 },
  screenTitle: { color: palette.text, fontSize: 28, fontWeight: '900', lineHeight: 34 },
  heroCard: {
    width: '100%',
    maxWidth: 860,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: 'rgba(91, 75, 255, 0.16)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.20,
    shadowRadius: 28,
    elevation: 8,
  },
  heroGradient: {
    padding: 24,
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
  heroIcon: {
    marginBottom: 12,
  },
  heroGlow: {
    position: 'absolute',
    right: -18,
    top: -18,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: palette.primary,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: palette.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: palette.muted,
    textAlign: 'center',
  },
  templateSection: {
    width: '100%',
    maxWidth: 860,
    marginBottom: 16,
    padding: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: palette.cardBorder,
    shadowColor: 'rgba(91, 75, 255, 0.08)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  templateSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  templateEyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  templateTitle: {
    marginTop: 4,
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
  },
  templatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
  },
  templatePillText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  templateCard: {
    flexGrow: 1,
    flexBasis: 240,
    minWidth: 220,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(247, 241, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(91, 75, 255, 0.12)',
  },
  templateIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(91, 75, 255, 0.08)',
  },
  templateCardTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
  },
  templateCardText: {
    marginTop: 6,
    color: palette.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  errorCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: palette.errorBg,
    marginBottom: 16,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.error,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 13,
    color: palette.error,
  },
  card: {
    width: '100%',
    maxWidth: 860,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    shadowColor: 'rgba(91, 75, 255, 0.10)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.text,
  },
  readyPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(91, 75, 255, 0.1)',
  },
  readyPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.text,
    marginBottom: 8,
    marginLeft: 2,
  },
  input: {
    height: 48,
    backgroundColor: 'rgba(247, 241, 255, 0.88)',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: palette.text,
    borderWidth: 0,
    ...webInputReset,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
    paddingVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    width: '100%',
    maxWidth: 860,
  },
  cancelButton: {
    flex: 0.4,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.80)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.cardBorder,
    shadowColor: 'rgba(91, 75, 255, 0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.text,
  },
  createButton: {
    flex: 0.6,
    height: 50,
    borderRadius: 12,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.7,
  },
  createButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.white,
  },
});
