import { useEffect, useState } from 'react';
import BillShareCard from '../components/BillShareCard';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const defaultForm = { name: '', description: '', totalAmount: 0, splitType: 'equal' };

const BillShare = () => {
  const [shares, setShares] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [joiningId, setJoiningId] = useState('');
  const { user } = useAuth();

  const loadShares = async () => {
    const { data } = await api.get('/shares');
    setShares(data);
  };

  useEffect(() => {
    loadShares();
  }, []);

  const createShare = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    try {
      await api.post('/shares', form);
      setForm(defaultForm);
      loadShares();
      setSuccessMessage('Share created successfully');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create share');
    }
  };

  const requestJoin = async (shareId) => {
    setJoinError('');
    setJoiningId(shareId);
    setSuccessMessage('');
    try {
      await api.post(`/shares/${shareId}/join`);
      loadShares();
      setSuccessMessage('Join request submitted');
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Failed to request join');
    } finally {
      setJoiningId('');
    }
  };

  const approveRequest = async (shareId, userId) => {
    setSuccessMessage('');
    try {
      await api.post(`/shares/${shareId}/approve`, { userId });
      loadShares();
      setSuccessMessage('Member approved');
    } catch (err) {
      setJoinError(err.response?.data?.message || 'Failed to approve member');
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 text-slate-100">
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-2xl font-semibold text-white">Create Bill Share</h2>
          {error && <p className="mt-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-200">{error}</p>}
          <form onSubmit={createShare} className="mt-4 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-black/30">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
              required
            />
            <textarea
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
            />
            <input
              placeholder="Total Amount"
              type="number"
              min="1"
              value={form.totalAmount}
              onChange={(e) => setForm((prev) => ({ ...prev, totalAmount: Number(e.target.value) }))}
              className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100 placeholder:text-slate-500"
              required
            />
            <select
              value={form.splitType}
              onChange={(e) => setForm((prev) => ({ ...prev, splitType: e.target.value }))}
              className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
            >
              <option value="equal">Equal</option>
              <option value="custom">Custom</option>
              <option value="percentage">Percentage</option>
            </select>
            <button type="submit" className="w-full rounded-full bg-brand-primary py-3 text-sm font-semibold text-white shadow shadow-brand-primary/40">
              Create Share
            </button>
          </form>
        </section>
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold text-white">Available Shares</h2>
            <div className="space-y-1 text-right text-sm">
              {joinError && <p className="text-red-300">{joinError}</p>}
              {successMessage && <p className="text-emerald-300">{successMessage}</p>}
            </div>
          </div>
          {shares.map((share) => (
            <BillShareCard
              key={share._id}
              share={share}
              onJoin={requestJoin}
              onApprove={approveRequest}
              joiningId={joiningId}
              currentUserId={user?.id}
            />
          ))}
          {!shares.length && <p className="text-sm text-slate-400">No shares yet.</p>}
        </section>
      </div>
    </main>
  );
};

export default BillShare;
