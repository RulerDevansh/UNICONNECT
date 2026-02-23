import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-8 sm:py-16">
      <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 shadow-2xl shadow-black/40">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">Welcome back</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in with the email you used during registration.</p>
        {error && <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-300">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">Password</label>
              <Link to="/forgot-password" className="text-xs text-purple-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
              required
            />
          </div>
          <button type="submit" className="w-full rounded-full bg-brand-primary py-3 text-white shadow shadow-brand-primary/40">
            Login
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-400">
          No account?{' '}
          <Link to="/register" className="font-semibold text-brand-primary">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
};

export default Login;
