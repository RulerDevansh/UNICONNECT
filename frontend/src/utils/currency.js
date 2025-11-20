const DEFAULT_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export const formatCurrency = (value, options = {}) => {
  const amount = Number(value);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  if (!options || (options.minimumFractionDigits === undefined && options.maximumFractionDigits === undefined)) {
    return DEFAULT_FORMATTER.format(safeAmount);
  }
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
  });
  return formatter.format(safeAmount);
};
