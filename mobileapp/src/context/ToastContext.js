import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

const ToastContext = createContext(null);
const TOAST_TTL_MS = 3500;

const ToastItem = ({ toast }) => {
  const translate = useRef(new Animated.Value(-12)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const toneStyle = {
    success: { borderColor: 'rgba(16,185,129,0.5)', backgroundColor: 'rgba(16,185,129,0.12)', color: '#bbf7d0' },
    error: { borderColor: 'rgba(239,68,68,0.5)', backgroundColor: 'rgba(239,68,68,0.12)', color: '#fecaca' },
    warning: { borderColor: 'rgba(245,158,11,0.5)', backgroundColor: 'rgba(245,158,11,0.12)', color: '#fde68a' },
    info: { borderColor: colors.border, backgroundColor: 'rgba(30,41,59,0.8)', color: '#e2e8f0' },
  }[toast.type || 'info'];

  Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  Animated.timing(translate, { toValue: 0, duration: 220, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          borderColor: toneStyle.borderColor,
          backgroundColor: toneStyle.backgroundColor,
          transform: [{ translateY: translate }],
          opacity,
        },
      ]}
    >
      <Text style={[styles.toastText, { color: toneStyle.color }]}>{toast.message}</Text>
    </Animated.View>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timeouts = useRef(new Map());
  const insets = useSafeAreaInsets();

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
    const toast = { id, message, type: options.type || 'info' };
    setToasts((prev) => [toast, ...prev].slice(0, 3));
    const timeout = setTimeout(() => removeToast(id), options.duration ?? TOAST_TTL_MS);
    timeouts.current.set(id, timeout);
  }, [removeToast]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={[styles.host, { top: insets.top + spacing.md }]}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 100,
    gap: spacing.sm,
  },
  toast: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
