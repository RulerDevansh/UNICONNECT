import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { verifyEmail, resendVerification } from '../services/authService';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const navigate = useNavigate();

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!email || !code) {
      setError('Both email and code are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyEmail({ email, code });
      setMessage(res.data.message || 'Email verified!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
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
      const res = await resendVerification({ email });
      setMessage(res.data.message || 'New code sent!');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-8 sm:py-16">
      <div className="rounded-2xl sm:rounded-3xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8 shadow-2xl shadow-black/40">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white">Verify your email</h1>
        <p className="mt-2 text-sm text-slate-400">
          We sent a 6-digit code to{' '}
          <span className="font-medium text-purple-400">{emailFromQuery || 'your email'}</span>.
          Enter it below to confirm your account.
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

        <form onSubmit={handleVerify} className="mt-6 space-y-4">
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
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 px-3 py-2 text-center text-2xl tracking-[0.5em] text-purple-300 placeholder:text-slate-600"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-brand-primary py-3 text-white shadow shadow-brand-primary/40 disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify Email'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
          <span>Didn't receive the code?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendLoading}
            className="font-semibold text-purple-400 hover:underline disabled:opacity-50"
          >
            {resendLoading ? 'Sending…' : 'Resend code'}
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-400">
          Already verified?{' '}
          <Link to="/login" className="font-semibold text-brand-primary">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
};

export default VerifyEmail;
