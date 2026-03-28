import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/listings', label: 'Listings' },
  { to: '/admin/disputes', label: 'Disputes' },
  { to: '/admin/users', label: 'Users' },
];

const AdminLayout = () => {
  const { user } = useAuth();
  const role = user?.role || 'user';

  return (
    <div className="min-h-screen bg-slate-950/70 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Admin Workspace</p>
            <h1 className="text-xl font-semibold text-white">Operations Control</h1>
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
            Role: <span className="text-white">{role}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/30 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-xs transition ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'border border-slate-800 text-slate-300 hover:border-slate-600'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
