import { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';

const defaultOptions = [
  { value: '', label: 'All Categories' },
  { value: 'physical', label: 'Physical' },
  { value: 'digital', label: 'Digital' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'merch', label: 'Merch' },
];

const variantStyles = {
  glass: {
    trigger:
      'border-white/20 bg-white/10 text-white shadow-inner shadow-white/5 hover:border-white/40 focus-visible:ring-white/60',
    menu: 'border-white/10 bg-slate-900/90 backdrop-blur-xl text-white shadow-2xl shadow-black/40',
    option: 'hover:bg-white/10 focus:bg-white/10 text-white',
    arrow: 'text-white/80',
  },
  solid: {
    trigger:
      'border-slate-700 bg-slate-900/80 text-slate-100 shadow-inner shadow-black/30 hover:border-slate-500 focus-visible:ring-brand-primary/60',
    menu: 'border-slate-700 bg-slate-900/95 text-slate-100 shadow-2xl shadow-black/50',
    option: 'hover:bg-slate-800 focus:bg-slate-800 text-slate-100',
    arrow: 'text-slate-400',
  },
};

const CategorySelect = ({
  value,
  onChange,
  options = defaultOptions,
  variant = 'glass',
  className = '',
  wrapperClassName = '',
  name,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const styles = variantStyles[variant] || variantStyles.glass;

  useEffect(() => {
    const handleClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find((option) => option.value === value) || options[0];

  const emitChange = (optionValue) => {
    onChange?.({ target: { value: optionValue, name } });
    setOpen(false);
  };

  return (
    <div ref={menuRef} className={classNames('relative w-full sm:w-auto', wrapperClassName)}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        className={classNames(
          'flex w-full items-center justify-between rounded-full px-5 py-3 text-sm font-semibold outline-none ring-1 ring-transparent transition focus-visible:ring-2',
          styles.trigger,
          disabled && 'cursor-not-allowed opacity-60',
          className
        )}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        <span>{selected?.label || 'Select'}</span>
        <svg
          className={classNames('ml-3 h-4 w-4 transition-transform', styles.arrow, open && 'rotate-180')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && !disabled && (
        <ul
          className={classNames(
            'absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-auto rounded-2xl border p-1 text-sm focus:outline-none',
            styles.menu
          )}
          role="listbox"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => emitChange(option.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      emitChange(option.value);
                    }
                  }}
                  className={classNames(
                    'flex w-full items-center justify-between rounded-xl px-4 py-2 text-left transition',
                    styles.option,
                    isSelected && 'bg-brand-primary/20 text-white'
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span>{option.label}</span>
                  {isSelected && (
                    <svg className="h-4 w-4 text-brand-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default CategorySelect;
