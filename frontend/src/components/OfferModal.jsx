import { useState } from 'react';
import api from '../services/api';

const OfferModal = ({ listingId, onClose, onSubmitted }) => {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const submitOffer = async (e) => {
    e.preventDefault();
    try {
      await api.post('/offers', { listing: listingId, amount: Number(amount), notes });
      onSubmitted?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit offer');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur">
      <form className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-black/40" onSubmit={submitOffer}>
        <h3 className="text-lg font-semibold text-white">Make an Offer</h3>
        {error && <p className="mt-2 rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>}
        <label className="mt-4 block text-sm font-medium text-slate-300">Amount</label>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
        />
        <label className="mt-4 block text-sm font-medium text-slate-300">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows="3"
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
        />
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-slate-600 px-4 py-2 text-slate-200">
            Cancel
          </button>
          <button type="submit" className="rounded-full bg-brand-primary px-4 py-2 text-white shadow shadow-brand-primary/40">
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default OfferModal;
