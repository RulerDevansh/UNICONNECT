import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ListingCard from '../../components/ListingCard';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-self' } }),
}));

vi.mock('../../context/SocketContext', () => ({
  useSocket: () => ({ socket: null }),
}));

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ pushToast: vi.fn() }),
}));

describe('ListingCard', () => {
  it('renders rental listing with per-day price text', () => {
    const listing = {
      _id: 'l-rental-1',
      title: 'Study Table Rental',
      description: 'Clean table for semester use',
      category: 'physical',
      listingType: 'rental',
      price: 150,
      rental: {
        ratePerDay: 120,
        minimumDays: 3,
      },
      seller: 'seller-1',
      status: 'active',
      images: [],
    };

    render(
      <MemoryRouter>
        <ListingCard listing={listing} />
      </MemoryRouter>
    );

    expect(screen.getByText(/^rental$/i, { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/\/day/i)).toBeInTheDocument();
  });
});
