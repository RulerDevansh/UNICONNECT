import { useEffect, useState } from 'react';
import { getUsers, updateUserSuspension, warnUser } from '../../services/adminService';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [filters, setFilters] = useState({ q: '', role: '', verified: '', suspended: '' });
  const [loading, setLoading] = useState(true);
  const [warningModal, setWarningModal] = useState({ open: false, user: null });
  const [warningReason, setWarningReason] = useState('');
  const [suspensionModal, setSuspensionModal] = useState({ open: false, user: null, suspended: false });
  const [suspensionReason, setSuspensionReason] = useState('');
  const warningPresets = [
    'Inappropriate listing',
    'Spam activity',
    'Harassment or abuse',
    'Misleading information',
  ];

  const load = async (page = meta.page) => {
    setLoading(true);
    const { data } = await getUsers({ page, limit: 10, sort: 'newest', ...filters });
    setUsers(data.data || []);
    setMeta({ page: data.page, totalPages: data.totalPages });
    setLoading(false);
  };

  useEffect(() => {
    load(1);
  }, [filters]);

  const openSuspensionModal = (user) => {
    const suspended = !user.suspended;
    setSuspensionReason('');
    setSuspensionModal({ open: true, user, suspended });
  };

  const closeSuspensionModal = () => {
    setSuspensionModal({ open: false, user: null, suspended: false });
    setSuspensionReason('');
  };

  const submitSuspension = async () => {
    if (!suspensionModal.user) return;
    await updateUserSuspension(suspensionModal.user._id, {
      suspended: suspensionModal.suspended,
      reason: suspensionModal.suspended ? suspensionReason : '',
    });
    closeSuspensionModal();
    load();
  };

  const openWarning = (user) => {
    setWarningReason('');
    setWarningModal({ open: true, user });
  };

  const closeWarning = () => {
    setWarningModal({ open: false, user: null });
    setWarningReason('');
  };

  const sendWarning = async () => {
    if (!warningModal.user) return;
    await warnUser(warningModal.user._id, { reason: warningReason || undefined });
    closeWarning();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-white">User Management</h2>
        <p className="text-sm text-slate-400">Search users and suspend accounts.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <input
          className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          placeholder="Search name or email"
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
        />
        <input
          className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          placeholder="Role"
          value={filters.role}
          onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
        />
        <input
          className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          placeholder="Verified (true/false)"
          value={filters.verified}
          onChange={(e) => setFilters((prev) => ({ ...prev, verified: e.target.value }))}
        />
        <input
          className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
          placeholder="Suspended (true/false)"
          value={filters.suspended}
          onChange={(e) => setFilters((prev) => ({ ...prev, suspended: e.target.value }))}
        />
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading users...</p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user._id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{user.name}</p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                  <p className="text-xs text-slate-500">Role: {user.role} • Verified: {String(user.verified)}</p>
                  {user.suspended && (
                    <p className="text-xs text-red-300">Suspended: {user.suspendedReason || 'no reason provided'}</p>
                  )}
                </div>
                {user.role !== 'admin' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openWarning(user)}
                      className="rounded-full border border-amber-400/60 px-3 py-1 text-xs text-amber-200"
                    >
                      Warn
                    </button>
                    <button
                      type="button"
                      onClick={() => openSuspensionModal(user)}
                      className={`rounded-full px-3 py-1 text-xs ${
                        user.suspended ? 'bg-emerald-500/70 text-white' : 'bg-red-500/70 text-white'
                      }`}
                    >
                      {user.suspended ? 'Unsuspend' : 'Suspend'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!users.length && <p className="text-sm text-slate-400">No users found.</p>}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Page {meta.page} of {meta.totalPages}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => load(Math.max(1, meta.page - 1))}
            disabled={meta.page <= 1}
            className="rounded-full border border-slate-700 px-3 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => load(Math.min(meta.totalPages, meta.page + 1))}
            disabled={meta.page >= meta.totalPages}
            className="rounded-full border border-slate-700 px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {warningModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Send warning</h3>
                <p className="text-xs text-slate-400">
                  Warning for {warningModal.user?.name || 'user'} ({warningModal.user?.email}).
                </p>
              </div>
              <button
                type="button"
                onClick={closeWarning}
                className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <label className="text-xs uppercase text-slate-500">Reason (optional)</label>
              <textarea
                rows={3}
                value={warningReason}
                onChange={(e) => setWarningReason(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                placeholder="Add context for the warning"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {warningPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setWarningReason(preset)}
                    className="rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-200"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeWarning}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendWarning}
                className="rounded-full bg-amber-500/80 px-4 py-2 text-xs text-white"
              >
                Send warning
              </button>
            </div>
          </div>
        </div>
      )}

      {suspensionModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {suspensionModal.suspended ? 'Suspend user' : 'Unsuspend user'}
                </h3>
                <p className="text-xs text-slate-400">
                  {suspensionModal.suspended
                    ? `Suspend ${suspensionModal.user?.name || 'user'}?`
                    : `Unsuspend ${suspensionModal.user?.name || 'user'}?`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeSuspensionModal}
                className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                Close
              </button>
            </div>

            {suspensionModal.suspended && (
              <div className="mt-4">
                <label className="text-xs uppercase text-slate-500">Reason (optional)</label>
                <textarea
                  rows={3}
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                  placeholder="Add a suspension reason"
                />
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeSuspensionModal}
                className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitSuspension}
                className={`rounded-full px-4 py-2 text-xs text-white ${
                  suspensionModal.suspended ? 'bg-red-500/70' : 'bg-emerald-500/70'
                }`}
              >
                {suspensionModal.suspended ? 'Suspend user' : 'Unsuspend user'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
