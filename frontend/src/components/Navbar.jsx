import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import logo from '../assets/logo.svg';

const navItems = [
  { to: '/', label: 'Home', private: false },
  { to: '/my-listings', label: 'My Listings', private: true },
  { to: '/shares', label: 'Sharing', private: true },
  { to: '/marketplace', label: 'Marketplace', private: true },
  { to: '/chat', label: 'Chat', private: true },
  { to: '/admin', label: 'Admin', private: true, roles: ['admin'] },
];

const Navbar = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const mobileMenuRef = useRef(null);
  const hamburgerRef = useRef(null);
  const mobileProfileRef = useRef(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileProfileOpen(false);
  }, [location.pathname]);

  // Close mobile menu on outside click (exclude hamburger button)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(e.target) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(e.target)
      ) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Close mobile profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mobileProfileRef.current && !mobileProfileRef.current.contains(e.target)) {
        setMobileProfileOpen(false);
      }
    };
    if (mobileProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileProfileOpen]);

  const getInitials = () => {
    if (!user?.name) return 'U';
    const words = user.name.trim().split(' ');
    if (words.length === 1) return words[0][0].toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  const filteredNavItems = navItems.filter((item) => {
    if (item.private && !user) return false;
    if (item.roles && !item.roles.includes(user?.role)) return false;
    return true;
  });

  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-900/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl font-semibold text-white transition-opacity hover:opacity-80">
          <img 
            src={logo} 
            alt="UniConnect Logo" 
            className="h-8 w-8 sm:h-10 sm:w-10" 
          />
          <span>UniConnect</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-300">
          {filteredNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded px-2 py-1 transition ${isActive ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`
                }
              >
                {item.label}
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
            <>
              <Link
                to="/notifications"
                className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
                title="Notifications"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  onBlur={() => setTimeout(() => setShowProfileDropdown(false), 200)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-sm font-semibold text-white shadow-lg transition hover:scale-105"
                  title={user.name}
                >
                  {getInitials()}
                </button>
                {showProfileDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-slate-800 bg-slate-900 py-2 shadow-xl">
                    <div className="border-b border-slate-800 px-4 py-2">
                      <p className="text-sm font-semibold text-white">{user.name}</p>
                      <p className="text-xs text-slate-400">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigate('/profile');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={() => {
                        navigate('/history');
                        setShowProfileDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      History
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setShowProfileDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-300 transition hover:bg-slate-800 hover:text-red-200"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>

        {/* Mobile right-side actions */}
        <div className="flex items-center gap-2 md:hidden">
          {user && (
            <>
              {/* Mobile profile icon */}
              <div ref={mobileProfileRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setMobileProfileOpen(!mobileProfileOpen); setMobileMenuOpen(false); }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary text-xs font-semibold text-white shadow-lg transition hover:scale-105"
                  title={user.name}
                >
                  {getInitials()}
                </button>
                {mobileProfileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-slate-800 bg-slate-900 py-2 shadow-xl z-50">
                    <div className="border-b border-slate-800 px-4 py-2">
                      <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { navigate('/profile'); setMobileProfileOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      Edit Profile
                    </button>
                    <button
                      onClick={() => { navigate('/history'); setMobileProfileOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
                    >
                      History
                    </button>
                    <button
                      onClick={() => { logout(); setMobileProfileOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-300 transition hover:bg-slate-800 hover:text-red-200"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
              {/* Notification bell */}
              <Link
                to="/notifications"
                className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white"
                title="Notifications"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            </>
          )}
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setMobileProfileOpen(false); }}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {mobileMenuOpen && (
        <div ref={mobileMenuRef} className="md:hidden border-t border-white/5 bg-slate-900/95 backdrop-blur-xl">
          <nav className="mx-auto max-w-6xl space-y-1 px-4 py-3">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <hr className="border-slate-800 my-2" />
            {!user ? (
              <div className="flex flex-col gap-2 pt-1 pb-2">
                <NavLink to="/login" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-white">
                  Login
                </NavLink>
                <NavLink to="/register" onClick={() => setMobileMenuOpen(false)} className="block rounded-full bg-brand-primary px-3 py-2.5 text-center text-sm font-semibold text-white shadow shadow-brand-primary/40">
                  Register
                </NavLink>
              </div>
            ) : null}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navbar;
