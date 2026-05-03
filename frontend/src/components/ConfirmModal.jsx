const ConfirmModal = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const toneClass =
    tone === 'danger'
      ? 'bg-red-600/80'
      : tone === 'warning'
        ? 'bg-amber-500/80'
        : 'bg-brand-primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300"
          >
            Close
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-xs text-white ${toneClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
