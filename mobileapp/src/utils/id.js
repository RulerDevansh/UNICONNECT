export const getId = (value) => {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value._id || value.id || value.toString?.() || '';
};

export const sameId = (a, b) => {
  const left = getId(a);
  const right = getId(b);
  return !!left && !!right && left === right;
};

