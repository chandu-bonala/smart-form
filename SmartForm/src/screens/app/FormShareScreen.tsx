import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import QRCode from 'qrcode';
import { SvgXml } from 'react-native-svg';
import { AppStackParamList } from '../../navigation/NavigationTypes';
import { formsService, FormItem } from '../../api/forms-service';
import { getErrorMessage } from '../../api/client';
import { WEB_BASE_URL } from '../../constants/api';
import { isValidEmail } from '../../utils';
import { ScheduleDateTimePicker } from '../../components/ScheduleDateTimePicker';
import { webInputReset } from '../../utils/webInputReset';

const local = {
  ink: '#172033',
  muted: '#6b7280',
  line: '#e7ebf6',
  soft: '#f7f8fc',
  blue: '#5b4bff',
  green: '#34c759',
  amber: '#f59e0b',
  red: '#ef4444',
};

const pad = (value: number) => `${value}`.padStart(2, '0');

const formatScheduleDateTime = (date: Date) => {
  const hour24 = date.getHours();
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const datePart = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return `${datePart} at ${pad(hour12)}:${pad(date.getMinutes())} ${period}`;
};

export const FormShareScreen: React.FC<NativeStackScreenProps<AppStackParamList, 'FormShare'>> = ({ route, navigation }) => {
  const { formId } = route.params;
  const [form, setForm] = useState<FormItem | null>(null);
  const [recipients, setRecipients] = useState<string[]>(['']);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  const publicUrl = form ? `${WEB_BASE_URL}/public/forms/${form.form_slug}` : '';

  useEffect(() => {
    const loadForm = async () => {
      try {
        const loaded = await formsService.get(formId);
        setForm(loaded);
        setSubject(`Fill out this form: ${loaded.title}`);
        setMessage(`Please complete this form using this link:\n${WEB_BASE_URL}/public/forms/${loaded.form_slug}`);
        const nextHour = new Date();
        nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
        setScheduledAt(nextHour);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    };

    loadForm();
  }, [formId]);

  const updateRecipient = (index: number, value: string) => {
    setRecipients((current) => current.map((item, idx) => (idx === index ? value : item)));
  };

  const addRecipient = () => {
    setRecipients((current) => [...current, '']);
  };

  const removeRecipient = (index: number) => {
    setRecipients((current) => current.filter((_, idx) => idx !== index));
  };

  const onSend = async () => {
    if (!form) return;

    const emails = recipients
      .map((recipient) => recipient.trim())
      .filter((recipient) => recipient.length > 0);

    if (emails.length === 0) {
      setError('Please add at least one recipient email.');
      return;
    }

    const invalid = emails.find((email) => !isValidEmail(email));
    if (invalid) {
      setError(`Invalid email address: ${invalid}`);
      return;
    }

    try {
      setError(null);
      setSending(true);
      await formsService.share(form.id, {
        emails,
        url: publicUrl,
        subject: subject.trim() || `Please fill out ${form.title}`,
        message: message.trim() || 'Please complete this form using the link below.',
      });
      Alert.alert('Success', 'Form link sent successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const onScheduleSend = async () => {
    if (!form) return;

    const emails = recipients
      .map((recipient) => recipient.trim())
      .filter((recipient) => recipient.length > 0);

    if (emails.length === 0) {
      setError('Please add at least one recipient email.');
      return;
    }

    const invalid = emails.find((email) => !isValidEmail(email));
    if (invalid) {
      setError(`Invalid email address: ${invalid}`);
      return;
    }

    if (!scheduledAt) {
      setError('Choose a valid send date and time.');
      return;
    }

    try {
      setError(null);
      setScheduling(true);
      await formsService.scheduleShare(form.id, {
        run_at: scheduledAt.toISOString(),
        emails,
        url: publicUrl,
        subject: subject.trim() || `Please fill out ${form.title}`,
        message: message.trim() || 'Please complete this form using the link below.',
      });
      Alert.alert('Scheduled', `Email send is queued for ${formatScheduleDateTime(scheduledAt)}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setScheduling(false);
    }
  };

  const openQr = async () => {
    if (!publicUrl) return;

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
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.shell}>
        <View style={styles.headerCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Share form</Text>
              <Text style={styles.title}>{form?.title ?? 'Loading...'}</Text>
              <Text style={styles.subtitle}>Send a Gmail invite now or schedule it from the same clean layout.</Text>
            </View>
            <View style={styles.heroBadge}>
              <Feather name={form?.is_public ? 'globe' : 'lock'} size={14} color={local.blue} />
            </View>
          </View>
          <View style={styles.heroMetaRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>
                {recipients.filter((item) => item.trim()).length} recipient
                {recipients.filter((item) => item.trim()).length === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{form?.is_public ? 'Public form' : 'Private form'}</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>Gmail send</Text>
            </View>
          </View>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        <View style={styles.card}>
          <Text style={styles.label}>Form link</Text>
          <View style={styles.linkRow}>
            <Text style={styles.linkText} selectable>{publicUrl || 'Loading form link...'}</Text>
          </View>
          <TouchableOpacity style={styles.qrButton} onPress={() => void openQr()} disabled={!publicUrl}>
            <Feather name="grid" size={16} color={local.blue} />
            <Text style={styles.qrButtonText}>QR</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Recipients</Text>
          {recipients.map((recipient, index) => (
            <View key={`recipient-${index}`} style={styles.recipientRow}>
              <TextInput
                value={recipient}
                onChangeText={(value) => updateRecipient(index, value)}
                placeholder="Recipient email"
                placeholderTextColor="#5EA0FF"
                autoCapitalize="none"
                keyboardType="email-address"
                style={[styles.input, styles.recipientInput]}
              />
              {recipients.length > 1 ? (
                <TouchableOpacity style={styles.removeButton} onPress={() => removeRecipient(index)}>
                  <Feather name="x" size={16} color={local.red} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          <TouchableOpacity style={styles.secondaryButton} onPress={addRecipient}>
            <Text style={styles.secondaryButtonText}>+ Add recipient</Text>
          </TouchableOpacity>

          <View style={styles.dualFieldGrid}>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Subject</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Email subject"
                placeholderTextColor="#5EA0FF"
                style={styles.input}
              />
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>Message</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Email message"
                placeholderTextColor="#5EA0FF"
                multiline
                style={[styles.input, styles.textArea]}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.schedulePanel} activeOpacity={0.88} onPress={() => setScheduleVisible(true)}>
            <View style={styles.schedulePanelIcon}>
              <Feather name="calendar" size={18} color={local.blue} />
            </View>
            <View style={styles.schedulePanelCopy}>
              <Text style={styles.schedulePanelLabel}>Schedule Gmail send</Text>
              <Text style={styles.schedulePanelValue}>
                {scheduledAt ? formatScheduleDateTime(scheduledAt) : 'Choose a date and time'}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={local.muted} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.primaryButton, sending ? styles.buttonDisabled : null]} onPress={onSend} disabled={sending}>
            {sending ? <ActivityIndicator color="#FFFFFF" /> : (
              <>
                <Feather name="send" size={16} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Send by Gmail</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryAction, scheduling ? styles.buttonDisabled : null]}
            onPress={onScheduleSend}
            disabled={scheduling}
          >
            {scheduling ? <ActivityIndicator color={local.blue} /> : (
              <>
                <Feather name="clock" size={16} color={local.blue} />
                <Text style={styles.secondaryActionText}>Schedule email</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <ScheduleDateTimePicker
        visible={scheduleVisible}
        title="Schedule Gmail send"
        confirmLabel="Apply time"
        initialDate={scheduledAt}
        onCancel={() => setScheduleVisible(false)}
        onConfirm={(date) => {
          setScheduledAt(date);
          setScheduleVisible(false);
        }}
      />

      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>Public URL QR</Text>
                <Text style={styles.modalTitle}>{form?.title ?? 'Form QR code'}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setQrVisible(false);
                  setQrSvg(null);
                }}
              >
                <Feather name="x" size={18} color={local.muted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalText}>Scan this QR code to open the public form page directly.</Text>

            <View style={styles.qrCard}>
              {qrLoading ? (
                <ActivityIndicator size="large" color={local.blue} />
              ) : qrSvg ? (
                <SvgXml xml={qrSvg} width={250} height={250} />
              ) : null}
            </View>

            <Text style={styles.publicUrlLabel}>Public URL</Text>
            <Text style={styles.publicUrlText} selectable>
              {publicUrl}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryModalButton} onPress={() => Linking.openURL(publicUrl)}>
                <Text style={styles.secondaryModalButtonText}>Open link</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryModalButton}
                onPress={() => {
                  setQrVisible(false);
                  setQrSvg(null);
                }}
              >
                <Text style={styles.primaryModalButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0E8FF' },
  content: { padding: 16, paddingBottom: 30, alignItems: 'center' },
  shell: { width: '100%', maxWidth: 620 },
  headerCard: { borderRadius: 22, padding: 16, marginBottom: 12, backgroundColor: '#FBF7FF', borderWidth: 1, borderColor: local.line, shadowColor: 'rgba(49, 34, 111, 0.10)', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 4 },
  eyebrow: { color: local.blue, fontWeight: '900', fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  title: { color: local.ink, fontSize: 24, fontWeight: '900', marginBottom: 6, lineHeight: 30 },
  subtitle: { color: local.muted, lineHeight: 18, maxWidth: 560 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  heroCopy: { flex: 1, paddingRight: 12 },
  heroBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: local.line },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  heroPill: { borderRadius: 999, backgroundColor: '#EEF4FF', borderWidth: 1, borderColor: local.line, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 8 },
  heroPillText: { color: local.blue, fontWeight: '800', fontSize: 12 },
  card: { width: '100%', backgroundColor: '#FBF7FF', borderRadius: 22, borderWidth: 1, borderColor: local.line, padding: 16 },
  label: { color: local.muted, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 },
  linkRow: { borderRadius: 16, borderWidth: 1, borderColor: local.line, backgroundColor: '#F7F1FF', padding: 1, marginBottom: 14 },
  linkText: { minHeight: 44, borderRadius: 14, backgroundColor: '#F7F1FF', paddingHorizontal: 14, paddingVertical: 11, color: local.ink },
  qrButton: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: local.blue,
    backgroundColor: '#F7F1FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 14,
  },
  qrButtonText: {
    color: local.blue,
    fontWeight: '900',
    marginLeft: 8,
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
    backgroundColor: '#FBF7FF',
    borderWidth: 1,
    borderColor: local.line,
    shadowColor: 'rgba(15, 23, 42, 0.12)',
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
    color: local.blue,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalTitle: {
    color: local.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF4FF',
  },
  modalText: {
    marginTop: 10,
    color: local.muted,
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
    borderColor: local.line,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
  },
  publicUrlLabel: {
    marginTop: 14,
    color: local.blue,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  publicUrlText: {
    marginTop: 6,
    color: local.ink,
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
    backgroundColor: '#F7F1FF',
    borderWidth: 1,
    borderColor: local.line,
  },
  secondaryModalButtonText: {
    color: local.blue,
    fontSize: 13,
    fontWeight: '900',
  },
  primaryModalButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: local.blue,
  },
  primaryModalButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  input: { minHeight: 44, borderRadius: 14, backgroundColor: '#F7F1FF', borderWidth: 0, paddingHorizontal: 14, color: local.ink, marginBottom: 12, ...webInputReset },
  textArea: { minHeight: 104, paddingTop: 12 },
  dualFieldGrid: { flexDirection: 'column', marginBottom: 4 },
  fieldBlock: { width: '100%', marginBottom: 4 },
  recipientRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  recipientInput: { flex: 1, marginRight: 10 },
  removeButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#F2ECFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: local.line },
  secondaryButton: { minHeight: 44, borderRadius: 14, borderWidth: 1, borderColor: local.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 14, backgroundColor: '#F7F1FF' },
  secondaryButtonText: { color: local.blue, fontWeight: '900' },
  primaryButton: { minHeight: 48, borderRadius: 16, backgroundColor: local.blue, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 16, marginLeft: 8 },
  secondaryAction: { minHeight: 46, borderRadius: 16, borderWidth: 1, borderColor: local.blue, alignItems: 'center', justifyContent: 'center', marginTop: 10, backgroundColor: '#F7F1FF', flexDirection: 'row' },
  secondaryActionText: { color: local.blue, fontWeight: '900', fontSize: 15, marginLeft: 8 },
  schedulePanel: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: local.line, backgroundColor: '#EEF4FF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 14 },
  schedulePanelIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center' },
  schedulePanelCopy: { flex: 1, paddingHorizontal: 12 },
  schedulePanelLabel: { color: local.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  schedulePanelValue: { color: local.ink, fontWeight: '800' },
  buttonDisabled: { opacity: 0.6 },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)', padding: 12, marginBottom: 12, width: '100%' },
  errorText: { color: local.red, fontWeight: '700' },
});
