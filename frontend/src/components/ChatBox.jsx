import { useEffect, useRef, useState } from 'react';

const ChatBox = ({ chat, messages, onSend, typingUsers, onTyping, currentUserId }) => {
  const [content, setContent] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setContent('');
  }, [chat?._id]);

  if (!chat) {
    return <p className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center text-slate-500">
      Select a conversation to start messaging.
    </p>;
  }

  const otherParticipants = chat.participants?.filter((participant) => participant._id !== currentUserId);
  const title = chat.isGroup 
    ? (chat.shareRef?.name || chat.name || 'Group Chat') 
    : (otherParticipants?.[0]?.name || 'Direct Chat');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSend(content);
    setContent('');
  };

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl shadow-black/30">
      <div className="border-b border-slate-800 p-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {typingUsers?.length > 0 && (
          <p className="text-xs text-slate-400">{typingUsers.join(', ')} typing…</p>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message._id}
            className={`flex flex-col ${message.sender?._id === currentUserId ? 'items-end text-right' : ''}`}
          >
            <span className="text-xs text-slate-400">
              {message.sender?._id === currentUserId ? 'You' : message.sender?.name || 'Classmate'} •{' '}
              {new Date(message.createdAt).toLocaleTimeString()}
            </span>
            <span
              className={`inline-block max-w-lg rounded px-3 py-2 text-sm ${
                message.sender?._id === currentUserId
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/30'
                  : 'bg-slate-800/80 text-slate-100'
              }`}
            >
              {message.content}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t border-slate-800 p-4">
        <div className="flex gap-3">
          <input
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (chat?._id) {
                onTyping?.(chat._id);
              }
            }}
            placeholder="Type a message"
            className="flex-1 rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
          />
          <button type="submit" className="rounded bg-brand-primary px-4 py-2 text-white shadow shadow-brand-primary/40">
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatBox;
