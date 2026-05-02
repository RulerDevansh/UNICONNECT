import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Send, Sparkles, Trash2, X } from 'lucide-react-native';
import { chatWithAssistant } from '../services/assistantService';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../theme';
import { AppButton } from './ui';

const starter = {
  role: 'assistant',
  content: 'Hi! I can help with app usage, listing discovery, and support guidance. Ask me anything.',
  ts: Date.now(),
};

const AIAssistantOverlay = () => {
  const navigation = useNavigation();
  const { isAuthenticated, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([starter]);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  const history = useMemo(
    () => messages.slice(-12).filter((m) => m.role === 'assistant' || m.role === 'user').map((m) => ({ role: m.role, content: m.content })),
    [messages]
  );

  if (loading || !isAuthenticated) return null;

  const send = async () => {
    const content = input.trim();
    if (!content || replying) return;
    const userMessage = { role: 'user', content, ts: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError('');
    setReplying(true);
    try {
      const { data } = await chatWithAssistant({ message: content, history });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data?.reply || 'I could not generate a response right now.',
          listings: Array.isArray(data?.listings) ? data.listings : [],
          shares: Array.isArray(data?.shares) ? data.shares : [],
          ts: Date.now(),
        },
      ]);
    } catch (err) {
      setError(err.response?.data?.message || 'Assistant is unavailable right now.');
    } finally {
      setReplying(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd?.({ animated: true }));
    }
  };

  const openListing = (item) => {
    setOpen(false);
    navigation.navigate('ListingDetail', { id: item.id });
  };

  const openShares = () => {
    setOpen(false);
    navigation.navigate('Sharing');
  };

  return (
    <>
      <Pressable style={styles.fab} onPress={() => setOpen(true)}>
        <Sparkles size={23} color="#fff" strokeWidth={2.6} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>AI Assistant</Text>
              <Text style={styles.headerSub}>Session-only chat</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <AppButton title="Clear" icon={Trash2} variant="outline" onPress={() => { setMessages([{ ...starter, ts: Date.now() }]); setError(''); }} />
              <AppButton title="Close" icon={X} variant="outline" onPress={() => setOpen(false)} />
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.messages}
            contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
          >
            {messages.map((message, index) => {
              const mine = message.role === 'user';
              return (
                <View key={`${message.ts}-${index}`} style={[styles.bubbleWrap, mine ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                  <View style={[styles.bubble, mine ? styles.userBubble : styles.assistantBubble]}>
                    <Text style={styles.bubbleText}>{message.content}</Text>
                    {message.listings?.slice(0, 3).map((item) => (
                      <Pressable key={item.id} style={styles.resultCard} onPress={() => openListing(item)}>
                        <Text style={styles.resultTitle}>{item.title}</Text>
                        <Text style={styles.resultMeta}>{item.category} | INR {item.price}</Text>
                      </Pressable>
                    ))}
                    {message.shares?.slice(0, 3).map((item) => (
                      <Pressable key={item.id} style={styles.resultCard} onPress={openShares}>
                        <Text style={styles.resultTitle}>{item.name}</Text>
                        <Text style={styles.resultMeta}>{item.shareType} | INR {item.totalAmount}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            })}
            {replying && <Text style={styles.loading}>Thinking...</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}
          </ScrollView>

          <View style={styles.composer}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask about listings, bidding, safety..."
              placeholderTextColor={colors.faint}
              style={styles.input}
              multiline
              maxLength={1200}
            />
            <AppButton title="Send" icon={Send} onPress={send} disabled={replying || !input.trim()} />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 92,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    zIndex: 20,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.mutedBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  headerSub: {
    color: colors.muted,
    fontSize: 12,
  },
  messages: {
    flex: 1,
  },
  bubbleWrap: {
    width: '100%',
  },
  bubble: {
    maxWidth: '84%',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  userBubble: {
    backgroundColor: colors.primary,
  },
  assistantBubble: {
    backgroundColor: colors.panel,
  },
  bubbleText: {
    color: colors.text,
    lineHeight: 20,
  },
  resultCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: 'rgba(2,6,23,0.45)',
  },
  resultTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  resultMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  loading: {
    color: colors.muted,
    marginLeft: spacing.md,
  },
  error: {
    color: '#fecaca',
    marginLeft: spacing.md,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.mutedBorder,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
  },
});

export default AIAssistantOverlay;
