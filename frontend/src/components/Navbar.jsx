import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const navItems = [
  { to: '/', label: 'Home', private: false },
  { to: '/listings/new', label: 'Sell', private: true },
  { to: '/my-listings', label: 'My Listings', private: true },
  { to: '/shares', label: 'Bill Share', private: true },
  { to: '/marketplace', label: 'Marketplace', private: true },
  { to: '/chat', label: 'Chat', private: true },
  { to: '/admin', label: 'Admin', private: true, roles: ['admin'] },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const { hasNewMessage } = useSocket();
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-900/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-semibold text-white">
          UniConnect
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-300">
          {navItems
            .filter((item) => {
              if (item.private && !user) return false;
              if (item.roles && !item.roles.includes(user?.role)) return false;
              return true;
            })
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded px-2 py-1 transition ${isActive ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`
                }
              >
                <span className="inline-flex items-center gap-1">
                  {item.label}
                  {item.to === '/chat' && hasNewMessage && (
                    <span className="relative inline-flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-primary opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-primary" />
                      <span className="sr-only">New messages</span>
                    </span>
                  )}
                </span>
              </NavLink>
            ))}
          {!user ? (
            <>
              <NavLink to="/login" className="text-slate-400 hover:text-white">
                Login
              </NavLink>
              <NavLink
                to="/register"
                className="rounded-full bg-brand-primary px-3 py-1 text-white shadow shadow-brand-primary/40"
              >
                Register
              </NavLink>
            </>
          ) : (
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-white/20 px-3 py-1 text-slate-200 transition hover:border-white/50"
            >
              Logout
            </button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
