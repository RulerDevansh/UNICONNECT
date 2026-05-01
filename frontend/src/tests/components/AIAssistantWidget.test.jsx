import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AIAssistantWidget from '../../components/AIAssistantWidget';

const mockUseAuth = vi.fn();
const mockChatWithAssistant = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../services/assistantService', () => ({
  chatWithAssistant: (...args) => mockChatWithAssistant(...args),
}));

describe('AIAssistantWidget', () => {
  beforeEach(() => {
    mockChatWithAssistant.mockReset();
  });

  it('does not render for unauthenticated users', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: false });
    render(<AIAssistantWidget />);
    expect(screen.queryByRole('button', { name: /open assistant/i })).not.toBeInTheDocument();
  });

  it('opens widget and sends user message', async () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, loading: false });
    mockChatWithAssistant.mockResolvedValue({
      data: {
        reply: 'Try Marketplace with category bike and max price 4000.',
        listings: [{ id: 'l1', title: 'Hostel Bike', category: 'bike', price: 3800 }],
        shares: [{ id: 's1', name: 'Mess Group Order', shareType: 'food', totalAmount: 180 }],
      },
    });

    render(<AIAssistantWidget />);

    fireEvent.click(screen.getByRole('button', { name: /open assistant/i }));
    fireEvent.change(screen.getByPlaceholderText(/ask about listings/i), {
      target: { value: 'show bikes under 4000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(mockChatWithAssistant).toHaveBeenCalledTimes(1);
    });

    expect(mockChatWithAssistant).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'show bikes under 4000' })
    );

    expect(await screen.findByText(/try marketplace with category bike/i)).toBeInTheDocument();
    expect(screen.getByText(/hostel bike/i)).toBeInTheDocument();
    expect(screen.getByText(/mess group order/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open hostel bike listing/i })).toHaveAttribute('href', '/listings/l1');
    expect(screen.getByRole('link', { name: /open mess group order sharing option/i })).toHaveAttribute('href', '/shares');

    fireEvent.click(screen.getByRole('button', { name: /clear/i }));
    expect(screen.getByText(/clear this conversation/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clear chat/i }));
    expect(screen.getByText(/hi! i can help with app usage/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close assistant/i }));
    expect(screen.getByRole('button', { name: /open assistant/i })).toBeInTheDocument();
  });
});
