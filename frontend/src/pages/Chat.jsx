import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import ChatBox from '../components/ChatBox';

const Chat = () => {
  const { socket, clearNewMessage } = useSocket();
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadChatIds, setUnreadChatIds] = useState(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const activeIdRef = useRef(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const activeChat = useMemo(() => chats.find((chat) => chat._id === activeId), [chats, activeId]);
  const participantMap = useMemo(() => {
    if (!activeChat?.participants) return {};
    return activeChat.participants.reduce((acc, participant) => {
      const key = participant._id?.toString?.() || participant.id;
      acc[key] = participant.name || 'Member';
      return acc;
    }, {});
  }, [activeChat]);
  const typingNames = typingUsers
    .map((id) => participantMap[id] || 'Someone')
    .filter((value, index, arr) => arr.indexOf(value) === index);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const preferredChatId = useMemo(() => searchParams.get('chatId'), [searchParams]);

  const updateChatParam = useCallback(
    (chatId) => {
      const next = new URLSearchParams(searchParams);
      if (chatId) {
        next.set('chatId', chatId);
      } else {
        next.delete('chatId');
      }
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const loadMessages = useCallback(
    async (chatId) => {
      const { data } = await api.get(`/chats/${chatId}/messages`);
      setMessages(data);
      if (socket) {
        data.forEach((msg) => {
          socket.emit('message:read', { chatId, messageId: msg._id });
        });
      }
      clearNewMessage();
    },
    [socket, clearNewMessage]
  );

  const loadChats = useCallback(async () => {
    const { data } = await api.get('/chats');
    
    // Filter out chats for expired shares (past deadline/departure time)
    const now = new Date();
    const activeChats = data.filter(chat => {
      if (!chat.shareRef) return true;
      
      // For cab sharing, check departure time
      if (chat.shareRef.shareType === 'cab' && chat.shareRef.departureTime) {
        return new Date(chat.shareRef.departureTime) > now;
      }
      
      // For food sharing, check deadline time
      if (chat.shareRef.shareType === 'food' && chat.shareRef.deadlineTime) {
        return new Date(chat.shareRef.deadlineTime) > now;
      }
      
      // For other sharing, check other deadline
      if (chat.shareRef.shareType === 'other' && chat.shareRef.otherDeadline) {
        return new Date(chat.shareRef.otherDeadline) > now;
      }
      
      return true;
    });
    
    setChats(activeChats);
    if (!activeChats.length) {
      setActiveId(null);
      setMessages([]);
      updateChatParam(null);
      return;
    }
    const current = preferredChatId || activeIdRef.current;
    const exists = current && activeChats.find((chat) => chat._id === current);
    const fallbackId = exists ? current : activeChats[0]._id;
    if (fallbackId) {
      setActiveId(fallbackId);
      loadMessages(fallbackId);
      updateChatParam(fallbackId);
    }
  }, [loadMessages, preferredChatId, updateChatParam]);

  const selectChat = (chatId) => {
    setActiveId(chatId);
    loadMessages(chatId);
    setTypingUsers([]);
    updateChatParam(chatId);
    setMobileChatOpen(true);
    setUnreadChatIds((prev) => {
      if (!prev.has(chatId)) return prev;
      const next = new Set(prev);
      next.delete(chatId);
      return next;
    });
  };

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    clearNewMessage();
  }, [clearNewMessage]);

  useEffect(() => {
    if (!socket || !activeId) return;
    socket.emit('joinChat', activeId);
    const handleMessage = (message) => {
      const rawChatId = message.chat?._id || message.chat;
      const messageChatId = rawChatId?.toString?.() || rawChatId;
      if (messageChatId === activeId) {
        setMessages((prev) => [...prev, message]);
        socket.emit('message:read', { chatId: activeId, messageId: message._id });
        clearNewMessage();
      } else {
        setUnreadChatIds((prev) => {
          if (prev.has(messageChatId)) return prev;
          return new Set(prev).add(messageChatId);
        });
        loadChats();
      }
    };
    const handleTyping = ({ user: userId }) => {
      setTypingUsers((prev) => {
        if (prev.includes(userId)) return prev;
        return [...prev, userId];
      });
      setTimeout(() => setTypingUsers((prev) => prev.filter((id) => id !== userId)), 2000);
    };
    const handleRead = ({ userId, messageId }) => {
      setMessages((prev) => prev.map((msg) => (msg._id === messageId ? { ...msg, readBy: [...(msg.readBy || []), userId] } : msg)));
    };
    const handleUnread = ({ chatId: unreadChatId }) => {
      if (unreadChatId && unreadChatId !== activeId) {
        setUnreadChatIds((prev) => {
          if (prev.has(unreadChatId)) return prev;
          return new Set(prev).add(unreadChatId);
        });
        loadChats();
      }
    };
    socket.on('message', handleMessage);
    socket.on('typing', handleTyping);
    socket.on('message:read', handleRead);
    socket.on('chat:unread', handleUnread);
    return () => {
      socket.emit('leaveChat', activeId);
      socket.off('message', handleMessage);
      socket.off('typing', handleTyping);
      socket.off('message:read', handleRead);
      socket.off('chat:unread', handleUnread);
    };
  }, [socket, activeId, loadChats, clearNewMessage]);

  const sendMessage = (content) => {
    if (!content.trim() || !socket || !activeId) return;
    socket.emit('message', { chatId: activeId, content });
  };

  const handleTyping = () => {
    if (!activeId) return;
    socket?.emit('typing', activeId);
  };

  const getChatLabel = useCallback((chat) => {
    if (chat.isGroup) {
      if (chat.shareRef?.name) {
        return chat.shareRef.name;
      }
      return chat.name || 'Group';
    }
    const currentUserId = String(user?.id || user?._id || '');
    const other = chat.participants?.find((participant) => {
      const pid = typeof participant._id === 'object' ? participant._id.toString() : String(participant._id || participant);
      return pid !== currentUserId;
    });
    
    if (chat.listingRef) {
      const productName = chat.listingRef?.title || 'Product';
      const otherName = other?.name || 'User';
      return `${productName} - ${otherName}`;
    }
    
    return other?.name || 'Direct Chat';
  }, [user?.id, user?._id]);

  // Local chat filter instead of remote user lookup
  const filteredChats = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return chats;
    return chats.filter((chat) => {
      const label = getChatLabel(chat).toLowerCase();
      if (label.includes(term)) return true;
      // Also match participant names
      return (chat.participants || []).some(p => (p.name || '').toLowerCase().includes(term));
    });
  }, [searchTerm, chats, getChatLabel]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10 text-slate-100">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Sidebar — visible on md+, or on mobile when chat is NOT open */}
        <aside className={`rounded-2xl border border-slate-800 bg-slate-900/70 p-4 ${mobileChatOpen ? 'hidden md:block' : 'block'}`}>
          <div className="flex gap-2">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search chats"
              className="flex-1 rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="rounded border border-slate-600 px-3 py-2 text-white text-sm"
              >
                Clear
              </button>
            )}
          </div>
          {/* Removed direct user search results for privacy */}
          <hr className="my-4" />
          <ul className="space-y-2 text-sm text-slate-300">
            {filteredChats.map((chat) => (
              <li key={chat._id}>
                <button
                  type="button"
                  onClick={() => selectChat(chat._id)}
                  className={`relative w-full rounded px-3 py-2 text-left ${activeId === chat._id ? 'bg-brand-primary/20 text-white' : 'text-slate-400'}`}
                >
                  <span className="block text-sm font-semibold">
                    {getChatLabel(chat)}
                    {unreadChatIds.has(chat._id) && (
                      <span className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                    )}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(chat.updatedAt).toLocaleDateString()} at {new Date(chat.updatedAt).toLocaleTimeString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        {/* Chat area — visible on md+, or on mobile when chat IS open */}
        <section className={`md:col-span-2 ${mobileChatOpen ? 'block' : 'hidden md:block'}`}>
          {/* Mobile back button */}
          <button
            type="button"
            onClick={() => setMobileChatOpen(false)}
            className="mb-3 flex items-center gap-1 text-sm text-slate-400 md:hidden"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to chats
          </button>
          <ChatBox
            chat={activeChat}
            messages={messages}
            typingUsers={typingNames}
            onSend={sendMessage}
            onTyping={handleTyping}
            currentUserId={user?.id || user?._id}
          />
        </section>
      </div>
    </main>
  );
};

export default Chat;
