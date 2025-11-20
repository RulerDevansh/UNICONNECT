import { useEffect, useState } from 'react';
import api from '../services/api';

const AdminDashboard = () => {
  const [flagged, setFlagged] = useState([]);
  const [reports, setReports] = useState([]);
  const [metrics, setMetrics] = useState(null);

  const load = async () => {
    const [flaggedRes, reportsRes, metricsRes] = await Promise.all([
      api.get('/admin/flagged'),
      api.get('/admin/reports'),
      api.get('/admin/metrics'),
    ]);
    setFlagged(flaggedRes.data);
    setReports(reportsRes.data);
    setMetrics(metricsRes.data);
  };

  useEffect(() => {
    load();
  }, []);

  const reviewListing = async (id, action) => {
    await api.post(`/admin/flagged/${id}`, { action });
    load();
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-100">
      <h1 className="text-4xl font-semibold text-white">Admin Dashboard</h1>
      {metrics && (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center shadow shadow-black/30">
              <p className="text-sm uppercase text-slate-400">{key}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-white">Flagged Listings</h2>
        <div className="mt-4 space-y-3">
          {flagged.map((listing) => (
            <div key={listing._id} className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <h3 className="font-semibold text-red-200">{listing.title}</h3>
              <p className="text-sm text-red-200/80">{listing.moderation?.reason}</p>
              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => reviewListing(listing._id, 'approve')}
                  className="rounded-full bg-emerald-500/80 px-3 py-1 text-white"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => reviewListing(listing._id, 'ban')}
                  className="rounded-full bg-red-600/80 px-3 py-1 text-white"
                >
                  Ban
                </button>
              </div>
            </div>
          ))}
          {!flagged.length && <p className="text-sm text-slate-400">No flagged listings.</p>}
        </div>
      </section>
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-white">Reports</h2>
        <div className="mt-4 space-y-3">
          {reports.map((report) => (
            <div key={report._id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <h3 className="font-semibold text-white">{report.listing?.title || 'General Report'}</h3>
              <p className="text-sm text-slate-300">{report.reason}</p>
              <p className="text-sm text-slate-400">{report.message}</p>
            </div>
          ))}
          {!reports.length && <p className="text-sm text-slate-400">No reports today.</p>}
        </div>
      </section>
    </main>
  );
};

export default AdminDashboard;
