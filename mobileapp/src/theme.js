import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#020617',
  surface: '#0f172a',
  surface2: '#111827',
  card: '#07111f',
  panel: '#1e293b',
  border: '#334155',
  mutedBorder: '#1f2937',
  text: '#f8fafc',
  muted: '#94a3b8',
  faint: '#64748b',
  primary: '#1d4ed8',
  primarySoft: '#2563eb',
  secondary: '#7c3aed',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  orange: '#f97316',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 118,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.mutedBorder,
    backgroundColor: 'rgba(7, 17, 31, 0.94)',
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  h2: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  muted: {
    color: colors.muted,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: '#020617',
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textarea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
