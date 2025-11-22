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
  const [results, setResults] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeIdRef = useRef(null);

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
    setChats(data);
    if (!data.length) {
      setActiveId(null);
      setMessages([]);
      updateChatParam(null);
      return;
    }
    const current = preferredChatId || activeIdRef.current;
    const exists = current && data.find((chat) => chat._id === current);
    const fallbackId = exists ? current : data[0]._id;
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
  };

  const startChat = async (userId) => {
    const { data } = await api.post('/chats', { userId });
    setSearchTerm('');
    setResults([]);
    await loadChats();
    setActiveId(data._id);
    loadMessages(data._id);
    updateChatParam(data._id);
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
    socket.on('message', handleMessage);
    socket.on('typing', handleTyping);
    socket.on('message:read', handleRead);
    return () => {
      socket.off('message', handleMessage);
      socket.off('typing', handleTyping);
      socket.off('message:read', handleRead);
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

  const searchUsers = async () => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    const { data } = await api.get('/users/lookup', { params: { q: searchTerm } });
    setResults(data);
  };

  const getChatLabel = (chat) => {
    if (chat.isGroup) return chat.name || 'Group';
    const currentUserId = String(user?.id || user?._id || '');
    const other = chat.participants?.find((participant) => {
      const pid = typeof participant._id === 'object' ? participant._id.toString() : String(participant._id || participant);
      return pid !== currentUserId;
    });
    return other?.name || 'Direct Chat';
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-100">
      <div className="grid gap-4 md:grid-cols-3">
        <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex gap-2">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  searchUsers();
                }
              }}
              placeholder="Find by email"
              className="flex-1 rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
            <button type="button" className="rounded bg-brand-primary px-3 py-2 text-white text-sm shadow shadow-brand-primary/40" onClick={searchUsers}>
              Search
            </button>
          </div>
          <div className="mt-2 space-y-2 text-sm text-slate-300">
            {results.map((result) => (
              <button
                key={result._id}
                type="button"
                onClick={() => startChat(result._id)}
                className="w-full rounded border border-slate-700 bg-slate-950/30 px-2 py-1 text-left"
              >
                {result.name} <span className="text-xs text-slate-500">{result.email}</span>
              </button>
            ))}
          </div>
          <hr className="my-4" />
          <ul className="space-y-2 text-sm text-slate-300">
            {chats.map((chat) => (
              <li key={chat._id}>
                <button
                  type="button"
                  onClick={() => selectChat(chat._id)}
                  className={`w-full rounded px-3 py-2 text-left ${activeId === chat._id ? 'bg-brand-primary/20 text-white' : 'text-slate-400'}`}
                >
                  <span className="block text-sm font-semibold">{getChatLabel(chat)}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(chat.updatedAt).toLocaleDateString()} at {new Date(chat.updatedAt).toLocaleTimeString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="md:col-span-2">
          <ChatBox
            chat={activeChat}
            messages={messages}
            typingUsers={typingNames}
            onSend={sendMessage}
            onTyping={handleTyping}
            currentUserId={user?.id}
          />
        </section>
      </div>
    </main>
  );
};

export default Chat;
