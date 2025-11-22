import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const navItems = [
  { to: '/', label: 'Home', private: false },
  { to: '/my-listings', label: 'My Listings', private: true },
  { to: '/my-sharing', label: 'My Sharing', private: true },
  { to: '/shares', label: 'Sharing', private: true },
  { to: '/marketplace', label: 'Marketplace', private: true },
  { to: '/chat', label: 'Chat', private: true },
  { to: '/history', label: 'History', private: true },
  { to: '/admin', label: 'Admin', private: true, roles: ['admin'] },
];

const requestItems = [
  { to: '/buy-requests', label: 'Buy Requests' },
  { to: '/my-requests', label: 'My Requests' },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const { hasNewMessage } = useSocket();
  const [showRequestsDropdown, setShowRequestsDropdown] = useState(false);
  const navigate = useNavigate();

  const getInitials = () => {
    if (!user?.name) return 'U';
    const words = user.name.trim().split(' ');
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

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
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRequestsDropdown(!showRequestsDropdown)}
                onBlur={() => setTimeout(() => setShowRequestsDropdown(false), 200)}
                className="rounded px-2 py-1 text-slate-400 transition hover:text-white focus:bg-white/10 focus:text-white"
              >
                Requests ▾
              </button>
              {showRequestsDropdown && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-slate-800 bg-slate-900 py-1 shadow-xl">
                  {requestItems.map((item) => (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => {
                        navigate(item.to);
                        setShowRequestsDropdown(false);
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
            <>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-white/20 px-3 py-1 text-slate-200 transition hover:border-white/50"
              >
                Logout
              </button>
              <Link
                to="/profile"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-sm font-semibold text-white shadow-lg transition hover:scale-105"
                title={user.name}
              >
                {getInitials()}
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
