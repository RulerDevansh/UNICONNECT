import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../services/authService';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await forgotPassword({ email });
      setMessage(res.data.message);
      // Redirect to reset page after 1.5s so user sees the message
      setTimeout(() => navigate(`/reset-password?email=${encodeURIComponent(email)}`), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-8 sm:py-16">
      <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 shadow-2xl shadow-black/40">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">Forgot password?</h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter your registered email and we'll send a 6-digit code to reset your password.
        </p>

        {message && (
          <p className="mt-4 rounded border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
              placeholder="your@email.com"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brand-primary py-3 text-white shadow shadow-brand-primary/40 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send Reset Code'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-400">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-brand-primary">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
};

export default ForgotPassword;
