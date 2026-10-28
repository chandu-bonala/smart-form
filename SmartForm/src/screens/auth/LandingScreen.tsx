import React from 'react';
import {
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BrandMark } from '../../components/BrandMark';
import { AuthStackParamList } from '../../navigation/NavigationTypes';

type LandingScreenProps = NativeStackScreenProps<AuthStackParamList, 'Landing'>;

const artBackground = require('../../../assets/landing-background.png');

const palette = {
  ink: '#171429',
  muted: '#6B6287',
  white: '#FFFFFF',
  primary: '#5B4BFF',
  primarySoft: '#ECE9FF',
  blueSoft: '#EAF2FF',
  border: 'rgba(228, 220, 255, 0.58)',
  panel: 'rgba(255,255,255,0.80)',
  panelStrong: 'rgba(255,255,255,0.92)',
};

const features = [
  {
    icon: 'edit-3' as const,
    title: 'Visual form builder',
    copy: 'Draft polished forms with a layout that feels calm from the first click.',
  },
  {
    icon: 'git-branch' as const,
    title: 'Conditional logic',
    copy: 'Route users through smarter paths with branching rules and follow-up questions.',
  },
  {
    icon: 'share-2' as const,
    title: 'Share anywhere',
    copy: 'Send public links, email invites, and collection pages that feel on-brand.',
  },
  {
    icon: 'pie-chart' as const,
    title: 'Analytics at a glance',
    copy: 'Review responses, completion rates, and trends without visual clutter.',
  },
  {
    icon: 'clock' as const,
    title: 'Scheduling tools',
    copy: 'Plan follow-ups and timed form campaigns with less friction.',
  },
  {
    icon: 'shield' as const,
    title: 'Secure access',
    copy: 'Keep admins, teams, and public respondents in clearly separated flows.',
  },
];

const stats = [
  { value: 'Forms', label: 'Create and organize' },
  { value: 'Responses', label: 'Review submissions' },
  { value: 'Logic', label: 'Branch intelligently' },
  { value: 'Share', label: 'Publish quickly' },
];

export const LandingScreen: React.FC<LandingScreenProps> = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 920;

  return (
    <ImageBackground source={artBackground} resizeMode="cover" style={styles.background}>
      <StatusBar style="dark" />
      <LinearGradient colors={['rgba(247,244,255,0.96)', 'rgba(239,245,255,0.94)', 'rgba(251,251,255,0.98)']} style={styles.overlay}>
        <View style={styles.orbOne} />
        <View style={styles.orbTwo} />
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.shell, isWide ? styles.shellWide : styles.shellStack]}>
              <View style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                  <BrandMark size={64} showLabel labelColor={palette.ink} />
                  <View style={styles.badge}>
                    <Feather name="star" size={14} color={palette.primary} />
                    <Text style={styles.badgeText}>New landing experience</Text>
                  </View>
                </View>

                <View style={styles.heroIntroRow}>
                  <View style={styles.heroCopyWrap}>
                <Text style={styles.eyebrow}>SmartForm</Text>
                    <Text style={styles.title}>A calm, premium workspace for modern forms.</Text>
                <Text style={styles.copy}>
                      Design forms, route responses, publish public links, and review analytics in one polished experience.
                </Text>
                  </View>

                  <View style={styles.heroStatRail}>
                    {stats.map((stat) => (
                      <View key={stat.value} style={styles.statCard}>
                        <Text style={styles.statValue}>{stat.value}</Text>
                        <Text style={styles.statLabel}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.primaryButton, styles.actionButton]}
                    onPress={() => navigation.navigate('Login')}
                    activeOpacity={0.92}
                  >
                    <Text style={styles.primaryButtonText}>Sign in</Text>
                    <Feather name="arrow-right" size={18} color={palette.white} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryButton, styles.actionButton]}
                    onPress={() => navigation.navigate('Register')}
                    activeOpacity={0.92}
                  >
                    <Text style={styles.secondaryButtonText}>Create account</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaCard}>
                    <Text style={styles.metaValue}>Builder</Text>
                    <Text style={styles.metaLabel}>create and edit forms</Text>
                  </View>
                  <View style={styles.metaCard}>
                    <Text style={styles.metaValue}>Logic</Text>
                    <Text style={styles.metaLabel}>branch with rules</Text>
                  </View>
                  <View style={styles.metaCard}>
                    <Text style={styles.metaValue}>Insights</Text>
                    <Text style={styles.metaLabel}>track responses clearly</Text>
                  </View>
                </View>
              </View>

              <View style={styles.featureColumn}>
                {features.map((feature) => (
                  <View key={feature.title} style={styles.featureCard}>
                    <View style={styles.featureIcon}>
                      <Feather name={feature.icon} size={18} color={palette.primary} />
                    </View>
                    <View style={styles.featureTextWrap}>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureCopy}>{feature.copy}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  orbOne: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(118, 87, 247, 0.12)',
  },
  orbTwo: {
    position: 'absolute',
    left: -80,
    bottom: 80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(78, 132, 244, 0.10)',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  shell: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: 18,
  },
  shellWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  shellStack: {
    flexDirection: 'column',
  },
  heroCard: {
    flex: 1.08,
    borderRadius: 32,
    padding: 30,
    backgroundColor: palette.panel,
    borderWidth: 0,
    shadowColor: 'rgba(94, 84, 180, 0.18)',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 1,
    shadowRadius: 34,
    elevation: 9,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(91,75,255,0.08)',
    borderWidth: 0,
  },
  badgeText: {
    marginLeft: 6,
    color: palette.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  eyebrow: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  title: {
    color: palette.ink,
    fontSize: 44,
    lineHeight: 49,
    fontWeight: '900',
    marginTop: 12,
    maxWidth: 620,
  },
  copy: {
    color: palette.muted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 14,
    maxWidth: 620,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
  },
  actionButton: {
    minHeight: 54,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: palette.primary,
    shadowColor: 'rgba(91, 75, 255, 0.35)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 6,
  },
  primaryButtonText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '900',
    marginRight: 8,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 0,
  },
  secondaryButtonText: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 24,
  },
  metaCard: {
    minWidth: 132,
    flexGrow: 1,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.64)',
    borderWidth: 0,
  },
  metaValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  metaLabel: {
    marginTop: 4,
    color: palette.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  featureColumn: {
    flex: 0.9,
    gap: 14,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 24,
    padding: 18,
    backgroundColor: palette.panelStrong,
    borderWidth: 0,
    shadowColor: 'rgba(91, 75, 255, 0.10)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
  },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureTextWrap: {
    flex: 1,
  },
  heroIntroRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 6,
    alignItems: 'flex-start',
  },
  heroCopyWrap: {
    flex: 1.2,
  },
  heroStatRail: {
    flex: 0.8,
    gap: 10,
  },
  statCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: 0,
    shadowColor: 'rgba(49,34,111,0.08)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 3,
  },
  statValue: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  featureTitle: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 6,
  },
  featureCopy: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
