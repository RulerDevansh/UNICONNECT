import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword, forgotPassword } from '../services/authService';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword({ email, code, newPassword });
      setMessage(res.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Please enter your email first.');
      return;
    }
    setError('');
    setMessage('');
    setResendLoading(true);
    try {
      const res = await forgotPassword({ email });
      setMessage(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl shadow-black/40">
        <h1 className="text-3xl font-semibold text-white">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter the 6-digit code sent to{' '}
          <span className="font-medium text-pink-400">{emailFromQuery || 'your email'}</span>.
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
          {!emailFromQuery && (
            <div>
              <label className="text-sm font-medium text-slate-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
                required
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-slate-300">6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-center text-2xl tracking-[0.5em] text-pink-300 placeholder:text-slate-600"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300">New password</label>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 pr-16 text-slate-100"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-300">Confirm new password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-slate-100"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brand-primary py-3 text-white shadow shadow-brand-primary/40 disabled:opacity-50"
          >
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
          <span>Didn't receive the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading}
            className="font-semibold text-pink-400 hover:underline disabled:opacity-50"
          >
            {resendLoading ? 'Sending…' : 'Resend code'}
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-400">
          <Link to="/login" className="font-semibold text-brand-primary">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
};

export default ResetPassword;
