import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MessageCircle, Send } from 'lucide-react-native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { AppButton, Card, EmptyState, Field, LoadingState, Message, Screen, Title } from '../components/ui';
import { colors, spacing } from '../theme';
import { formatDateTime } from '../utils/format';
import { getId } from '../utils/id';

const activeChatFilter = (chat) => {
  if (!chat.shareRef) return true;
  const now = new Date();
  if (chat.shareRef.shareType === 'cab' && chat.shareRef.departureTime) return new Date(chat.shareRef.departureTime) > now;
  if (chat.shareRef.shareType === 'food' && chat.shareRef.deadlineTime) return new Date(chat.shareRef.deadlineTime) > now;
  if (chat.shareRef.shareType === 'other' && chat.shareRef.otherDeadline) return new Date(chat.shareRef.otherDeadline) > now;
  return true;
};

const ChatPill = memo(({ item, label, active, unread, onPress }) => (
  <Pressable onPress={() => onPress(item._id)} style={[styles.chatPill, active && styles.chatPillActive]}>
    <MessageCircle size={15} color={active ? colors.text : colors.muted} />
    <Text numberOfLines={1} style={[styles.chatPillText, active && { color: colors.text }]}>
      {label} {unread ? '*' : ''}
    </Text>
    <Text style={styles.chatPillDate}>{formatDateTime(item.updatedAt)}</Text>
  </Pressable>
));

const MessageItem = memo(({ item, mine }) => (
  <View style={[styles.messageRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
    <View style={[styles.messageBubble, mine ? styles.mine : styles.theirs]}>
      <Text style={styles.messageMeta}>{mine ? 'You' : item.sender?.name || 'Classmate'}</Text>
      <Text style={styles.messageText}>{item.content}</Text>
    </View>
  </View>
));

const ChatScreen = ({ route }) => {
  const preferredChatId = route.params?.chatId;
  const { user } = useAuth();
  const { socket, isConnected, connectionError, reconnectSocket, clearNewMessage } = useSocket();
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(preferredChatId || null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadChatIds, setUnreadChatIds] = useState(new Set());
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const listRef = useRef(null);
  const activeIdRef = useRef(activeId);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  const activeChat = useMemo(() => chats.find((chat) => chat._id === activeId), [chats, activeId]);

  const getChatLabel = useCallback((chat) => {
    if (chat.isGroup) return chat.shareRef?.name || chat.name || 'Group';
    const currentUserId = getId(user);
    const other = chat.participants?.find((participant) => getId(participant) !== currentUserId);
    if (chat.listingRef) {
      return `${chat.listingRef?.title || 'Product'} - ${other?.name || 'User'}`;
    }
    return other?.name || 'Direct Chat';
  }, [user]);

  const loadMessages = useCallback(async (chatId) => {
    const { data } = await api.get(`/chats/${chatId}/messages`);
    setMessages(data || []);
    if (socket?.connected) {
      (data || []).forEach((msg) => socket.emit('message:read', { chatId, messageId: msg._id }));
    }
    clearNewMessage();
    setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 80);
  }, [socket, clearNewMessage]);

  const loadChats = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/chats');
      const activeChats = (data || []).filter(activeChatFilter);
      setChats(activeChats);
      if (!activeChats.length) {
        setActiveId(null);
        setMessages([]);
        return;
      }
      const current = preferredChatId || activeIdRef.current;
      const fallback = activeChats.find((chat) => chat._id === current)?._id || activeChats[0]._id;
      setActiveId(fallback);
      await loadMessages(fallback);
      setChatError('');
    } catch (err) {
      setChatError(err.response?.data?.message || 'Unable to load chats.');
    } finally {
      setLoading(false);
    }
  }, [preferredChatId, loadMessages]);

  useFocusEffect(useCallback(() => { loadChats(); clearNewMessage(); }, [loadChats, clearNewMessage]));

  useEffect(() => {
    if (connectionError) {
      setChatError(connectionError);
    } else if (isConnected) {
      setChatError('');
    }
  }, [connectionError, isConnected]);

  useEffect(() => {
    if (!socket || !isConnected || !activeId) return undefined;
    socket.emit('joinChat', activeId);
    const handleMessage = (message) => {
      const messageChatId = getId(message.chat);
      if (messageChatId === activeId) {
        setMessages((prev) => (prev.some((msg) => msg._id === message._id) ? prev : [...prev, message]));
        socket.emit('message:read', { chatId: activeId, messageId: message._id });
        clearNewMessage();
        setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 60);
      } else {
        setUnreadChatIds((prev) => new Set(prev).add(messageChatId));
        loadChats();
      }
    };
    const handleTyping = ({ user: userId }) => {
      setTypingUsers((prev) => prev.includes(userId) ? prev : [...prev, userId]);
      setTimeout(() => setTypingUsers((prev) => prev.filter((id) => id !== userId)), 2000);
    };
    const handleRead = ({ userId, messageId }) => {
      setMessages((prev) => prev.map((msg) => msg._id === messageId ? { ...msg, readBy: [...(msg.readBy || []), userId] } : msg));
    };
    const handleUnread = ({ chatId }) => {
      if (chatId && chatId !== activeId) setUnreadChatIds((prev) => new Set(prev).add(chatId));
    };
    socket.on('message', handleMessage);
    socket.on('typing', handleTyping);
    socket.on('message:read', handleRead);
    socket.on('chat:unread', handleUnread);
    const handleMessageError = ({ error }) => setChatError(`Message error: ${error}`);
    socket.on('message:error', handleMessageError);
    return () => {
      socket.emit('leaveChat', activeId);
      socket.off('message', handleMessage);
      socket.off('typing', handleTyping);
      socket.off('message:read', handleRead);
      socket.off('chat:unread', handleUnread);
      socket.off('message:error', handleMessageError);
    };
  }, [socket, isConnected, activeId, loadChats, clearNewMessage]);

  const selectChat = useCallback((chatId) => {
    setActiveId(chatId);
    setTypingUsers([]);
    loadMessages(chatId);
    setUnreadChatIds((prev) => {
      const next = new Set(prev);
      next.delete(chatId);
      return next;
    });
  }, [loadMessages]);

  const send = () => {
    const text = content.trim();
    if (!text || !activeId || sending) return;

    if (!socket?.connected || !isConnected) {
      setChatError(connectionError || 'Chat is still connecting. Message was not sent.');
      reconnectSocket?.();
      return;
    }

    setSending(true);
    setChatError('');
    socket.emit('message', { chatId: activeId, content: text });
    setContent('');
    setSending(false);
  };

  const filteredChats = useMemo(() => chats.filter((chat) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return getChatLabel(chat).toLowerCase().includes(term) || chat.participants?.some((p) => (p.name || '').toLowerCase().includes(term));
  }), [chats, getChatLabel, searchTerm]);

  const renderChatItem = useCallback(({ item }) => (
    <ChatPill
      item={item}
      label={getChatLabel(item)}
      active={activeId === item._id}
      unread={unreadChatIds.has(item._id)}
      onPress={selectChat}
    />
  ), [activeId, getChatLabel, selectChat, unreadChatIds]);

  const renderMessageItem = useCallback(({ item }) => (
    <MessageItem item={item} mine={getId(item.sender) === getId(user)} />
  ), [user]);

  const participantNames = typingUsers.map((id) => {
    const participant = activeChat?.participants?.find((p) => getId(p) === id);
    return participant?.name || 'Someone';
  });

  if (loading) return <Screen><LoadingState title="Loading chats..." /></Screen>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen scroll={false}>
        <View style={styles.container}>
          <Title subtitle="Direct and group conversations.">Chat</Title>
          <Field label="Search chats" value={searchTerm} onChangeText={setSearchTerm} />
          {!isConnected && <Message type="warning">Chat is connecting...</Message>}
          {!!chatError && <Message type="error">{chatError}</Message>}
          <View style={styles.chatList}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={filteredChats}
              keyExtractor={(item) => item._id}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={5}
              ListEmptyComponent={<EmptyState title="No chats yet." subtitle="Start from a listing, rental, or share." />}
              renderItem={renderChatItem}
            />
          </View>

          <Card style={styles.chatBox}>
            {activeChat ? (
              <>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatTitle}>{getChatLabel(activeChat)}</Text>
                  {participantNames.length > 0 && <Text style={styles.typing}>{participantNames.join(', ')} typing...</Text>}
                </View>
                <FlatList
                  ref={listRef}
                  data={messages}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={[styles.messages, !messages.length && styles.messagesEmpty]}
                  initialNumToRender={18}
                  maxToRenderPerBatch={10}
                  windowSize={7}
                  removeClippedSubviews={Platform.OS === 'android'}
                  ListEmptyComponent={<EmptyState title="No messages yet." subtitle="Send the first message to begin this conversation." />}
                  onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: true })}
                  renderItem={renderMessageItem}
                />
                <View style={styles.composer}>
                  <TextInput
                    value={content}
                    onChangeText={(value) => {
                      setContent(value);
                      if (activeId && socket?.connected) socket.emit('typing', activeId);
                    }}
                    placeholder="Type a message"
                    placeholderTextColor={colors.faint}
                    style={styles.input}
                  />
                  <AppButton
                    title={sending ? 'Sending' : 'Send'}
                    icon={Send}
                    onPress={send}
                    disabled={!content.trim() || !activeId || sending}
                    style={styles.sendButton}
                  />
                </View>
              </>
            ) : (
              <EmptyState title="Select a conversation to start messaging." />
            )}
          </Card>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: 90,
  },
  chatList: {
    flexGrow: 0,
    minHeight: 76,
    maxHeight: 80,
  },
  chatPill: {
    width: 188,
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: spacing.sm,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chatPillActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(29,78,216,0.22)',
  },
  chatPillText: {
    color: colors.muted,
    fontWeight: '800',
    marginTop: 3,
  },
  chatPillDate: {
    color: colors.faint,
    fontSize: 11,
    marginTop: 4,
  },
  chatBox: {
    flex: 1,
    marginTop: spacing.md,
    padding: 0,
    overflow: 'hidden',
  },
  chatHeader: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.mutedBorder,
  },
  chatTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  typing: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  messages: {
    padding: spacing.md,
    gap: spacing.sm,
    flexGrow: 1,
  },
  messagesEmpty: {
    justifyContent: 'center',
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  mine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirs: {
    backgroundColor: colors.panel,
    borderBottomLeftRadius: 4,
  },
  messageMeta: {
    color: '#dbeafe',
    fontSize: 10,
    marginBottom: 2,
  },
  messageText: {
    color: colors.text,
    lineHeight: 20,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.mutedBorder,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    color: colors.text,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bg,
  },
  sendButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
});

export default ChatScreen;
