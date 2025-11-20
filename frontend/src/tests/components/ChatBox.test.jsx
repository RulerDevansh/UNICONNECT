import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ChatBox from '../../components/ChatBox';

const sampleChat = {
  _id: 'chat1',
  isGroup: false,
  participants: [{ _id: 'u1', name: 'Jess' }, { _id: 'u2', name: 'You' }],
};

const sampleMessages = [
  { _id: 'm1', sender: { _id: 'u1', name: 'Jess' }, content: 'Hello there', createdAt: new Date().toISOString() },
];

describe('ChatBox', () => {
  it('renders placeholder when no chat selected', () => {
    render(<ChatBox />);
    expect(screen.getByText(/select a conversation/i)).toBeInTheDocument();
  });

  it('emits typing events as the user types', () => {
    const handleTyping = vi.fn();
    render(
      <ChatBox
        chat={sampleChat}
        messages={sampleMessages}
        typingUsers={['Jess']}
        onSend={vi.fn()}
        onTyping={handleTyping}
        currentUserId="u2"
      />
    );
    const input = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(input, { target: { value: 'new message' } });
    expect(handleTyping).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Jess typing/)).toBeInTheDocument();
  });

  it('submits message contents through onSend callback', () => {
    const handleSend = vi.fn();
    render(
      <ChatBox
        chat={sampleChat}
        messages={sampleMessages}
        typingUsers={[]}
        onSend={handleSend}
        currentUserId="u2"
      />
    );
    const input = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(input, { target: { value: 'Bid ₹5' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(handleSend).toHaveBeenCalledWith('Bid ₹5');
    expect(input).toHaveValue('');
  });

  it('shows participant names and highlights current user messages', () => {
    render(
      <ChatBox
        chat={sampleChat}
        messages={[...sampleMessages, { _id: 'm2', sender: { _id: 'u2', name: 'You' }, content: 'Sure thing', createdAt: new Date().toISOString() }]}
        typingUsers={[]}
        onSend={vi.fn()}
        currentUserId="u2"
      />
    );
    expect(screen.getByRole('heading', { name: /jess/i })).toBeInTheDocument();
    expect(screen.getByText(/You •/i)).toBeInTheDocument();
  });
});
