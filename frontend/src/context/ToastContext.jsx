import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const TOAST_TTL_MS = 3800;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timeouts = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeout = timeouts.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeouts.current.delete(id);
    }
  }, []);

  const pushToast = useCallback((message, options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast = {
      id,
      message,
      type: options.type || 'info',
    };
    setToasts((prev) => [toast, ...prev].slice(0, 3));
    const ttl = options.duration ?? TOAST_TTL_MS;
    const timeout = setTimeout(() => removeToast(id), ttl);
    timeouts.current.set(id, timeout);
  }, [removeToast]);

  const value = useMemo(() => ({ pushToast, removeToast }), [pushToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-3 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-enter pointer-events-auto w-full max-w-md rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur ${
              toast.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                : toast.type === 'error'
                  ? 'border-red-400/40 bg-red-500/10 text-red-100'
                  : toast.type === 'warning'
                    ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
                    : 'border-slate-700/80 bg-slate-900/80 text-slate-100'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="leading-snug">{toast.message}</p>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-200/80"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
