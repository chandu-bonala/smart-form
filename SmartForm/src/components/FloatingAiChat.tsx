import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { aiService, AiChatMessage } from '../api/ai-service';
import { getErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface FloatingAiChatProps {
  formId?: string;
}

const GREETING: AiChatMessage = {
  role: 'assistant',
  content: 'Hi! I’m SmartForm AI. Tell me what you’re building, and I can help shape your form.',
};

export const FloatingAiChat: React.FC<FloatingAiChatProps> = ({ formId }) => {
  const { isAuthenticated } = useAuth();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([GREETING]);
  const [suggestions, setSuggestions] = useState<string[]>([
    'Help me plan a form',
    'How can I improve my questions?',
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, sending, visible]);

  if (!isAuthenticated) return null;

  const sendMessage = async (text = draft) => {
    const message = text.trim();
    if (!message || sending) return;

    const history = messages.filter((item) => item !== GREETING);
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setDraft('');
    setSuggestions([]);
    setSending(true);

    try {
      const response = await aiService.chat({
        message,
        history,
        ...(formId ? { form_id: formId } : {}),
      });
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: response.answer || 'I couldn’t prepare an answer. Try rephrasing your question.' },
      ]);
      setSuggestions([...response.follow_up_questions, ...response.suggested_actions].slice(0, 3));
    } catch (error) {
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: getErrorMessage(error) },
      ]);
    } finally {
      setSending(false);
    }
  };

  const panelWidth = Math.min(390, screenWidth - 28);
  const panelHeight = Math.min(640, screenHeight - 112);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open SmartForm AI chat"
        onPress={() => setVisible(true)}
        style={styles.fab}
      >
        <Ionicons name="chatbubble-ellipses" size={25} color="#FFFFFF" />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close chat"
            style={styles.backdrop}
            onPress={() => setVisible(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[
              styles.panelPosition,
              { width: panelWidth, height: panelHeight },
              Platform.OS === 'web' ? { position: 'fixed' as any } : null,
            ]}
          >
            <View style={styles.panel}>
              <View style={styles.header}>
                <View style={styles.headerIcon}>
                  <Ionicons name="sparkles" size={18} color="#7657F7" />
                </View>
                <View style={styles.headerCopy}>
                  <Text style={styles.title}>SmartForm AI</Text>
                  <Text style={styles.subtitle}>Your form-building coach</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close chat"
                  onPress={() => setVisible(false)}
                  hitSlop={10}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={22} color="#716C87" />
                </Pressable>
              </View>

              <ScrollView
                ref={scrollRef}
                style={styles.messages}
                contentContainerStyle={styles.messagesContent}
                keyboardShouldPersistTaps="handled"
              >
                {messages.map((item, index) => (
                  <View
                    key={`${item.role}-${index}`}
                    style={[
                      styles.messageBubble,
                      item.role === 'user' ? styles.userBubble : styles.assistantBubble,
                    ]}
                  >
                    <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>
                      {item.content}
                    </Text>
                  </View>
                ))}
                {sending ? (
                  <View style={[styles.messageBubble, styles.assistantBubble, styles.loadingBubble]}>
                    <ActivityIndicator size="small" color="#7657F7" />
                    <Text style={styles.assistantText}>Thinking…</Text>
                  </View>
                ) : null}
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    style={styles.suggestion}
                    onPress={() => sendMessage(suggestion)}
                    disabled={sending}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                    <Ionicons name="arrow-up" size={15} color="#7657F7" />
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.composer}>
                <TextInput
                  accessibilityLabel="Message SmartForm AI"
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Ask about your form…"
                  placeholderTextColor="#A09BB6"
                  multiline
                  maxLength={2000}
                  style={styles.input}
                  onSubmitEditing={() => sendMessage()}
                  blurOnSubmit={false}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  onPress={() => sendMessage()}
                  disabled={!draft.trim() || sending}
                  style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]}
                >
                  <Ionicons name="arrow-up" size={19} color="#FFFFFF" />
                </Pressable>
              </View>
              <Text style={styles.footer}>AI can make mistakes. Review suggestions before publishing.</Text>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#7657F7',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 999,
    shadowColor: '#31226F',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(23, 20, 41, 0.18)',
  },
  panelPosition: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    maxWidth: '100%',
  },
  panel: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: '#171429',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 14,
  },
  header: {
    minHeight: 76,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F0FF',
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#ECE9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, marginLeft: 11 },
  title: { color: '#171429', fontSize: 16, fontWeight: '800' },
  subtitle: { color: '#716C87', fontSize: 12, marginTop: 3 },
  closeButton: { padding: 4 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, gap: 10 },
  messageBubble: {
    maxWidth: '88%',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 16,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F3FF',
    borderBottomLeftRadius: 5,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#7657F7',
    borderBottomRightRadius: 5,
  },
  assistantText: { color: '#312D44', fontSize: 14, lineHeight: 20 },
  userText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20 },
  loadingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestion: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#DED9FB',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  suggestionText: { color: '#514B65', fontSize: 12, flexShrink: 1 },
  composer: {
    marginHorizontal: 13,
    marginTop: 8,
    paddingLeft: 14,
    paddingRight: 7,
    minHeight: 48,
    maxHeight: 112,
    borderWidth: 1,
    borderColor: '#DED9FB',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    maxHeight: 88,
    color: '#272338',
    fontSize: 14,
    paddingVertical: 11,
    outlineStyle: 'none' as any,
  },
  sendButton: {
    width: 34,
    height: 34,
    marginLeft: 8,
    borderRadius: 17,
    backgroundColor: '#7657F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.45 },
  footer: {
    color: '#A09BB6',
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 11,
  },
});
