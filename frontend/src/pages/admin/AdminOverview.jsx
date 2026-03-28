import { useEffect, useMemo, useState } from 'react';
import { getOverviewMetrics, getTrends } from '../../services/adminService';

const AdminOverview = () => {
  const [metrics, setMetrics] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);

  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 14);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      bucket: 'day',
    };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [metricsRes, trendsRes] = await Promise.all([
        getOverviewMetrics(),
        getTrends(dateRange),
      ]);
      setMetrics(metricsRes.data);
      setTrends(trendsRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !metrics) {
    return <p className="text-sm text-slate-400">Loading analytics...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">Overview</h2>
        <p className="text-sm text-slate-400">Operational health across listings and users.</p>
      </div>

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <p className="text-xs uppercase text-slate-500">{key}</p>
              <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      )}

      {trends && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Trends</h3>
              <p className="text-xs text-slate-400">Last 14 days - bucketed daily</p>
            </div>
            <button
              type="button"
              onClick={load}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500"
            >
              Refresh
            </button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {['users', 'listings', 'transactions'].map((series) => (
              <div key={series} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <p className="text-xs uppercase text-slate-500">{series}</p>
                <div className="mt-2 space-y-1 text-sm text-slate-300">
                  {(trends[series] || []).map((item) => (
                    <div key={item._id} className="flex items-center justify-between">
                      <span>{item._id}</span>
                      <span className="text-white">{item.count}</span>
                    </div>
                  ))}
                  {!trends[series]?.length && <p className="text-xs text-slate-500">No data</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOverview;
