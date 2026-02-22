import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(form);
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to register');
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-black/40">
        <h1 className="text-3xl font-semibold text-white">Create your account</h1>
        <p className="mt-2 text-sm text-slate-400">Use any email you can access for verification.</p>
        {error && <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-300">Name</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
              required
            />
          </div>
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
            <label className="text-sm font-medium text-slate-300">Password</label>
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
            Register
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-primary">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
};

export default Register;
