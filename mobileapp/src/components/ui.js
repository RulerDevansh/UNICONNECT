import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, commonStyles, radius, spacing } from '../theme';

export const Screen = ({ children, scroll = true, contentStyle }) => {
  if (!scroll) return <SafeAreaView edges={['top']} style={[commonStyles.screen, contentStyle]}>{children}</SafeAreaView>;
  return (
    <SafeAreaView edges={['top']} style={commonStyles.screen}>
      <ScrollView
        contentContainerStyle={[commonStyles.content, contentStyle, { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
};

export const Title = ({ children, subtitle }) => (
  <View style={{ marginBottom: spacing.lg }}>
    <Text style={commonStyles.title}>{children}</Text>
    {!!subtitle && <Text style={[commonStyles.muted, { marginTop: spacing.xs }]}>{subtitle}</Text>}
  </View>
);

export const Card = ({ children, style }) => <View style={[commonStyles.card, style]}>{children}</View>;

export const AppButton = ({ title, onPress, variant = 'primary', disabled, style, textStyle, icon: Icon }) => {
  const variantStyle = {
    primary: styles.primaryButton,
    secondary: styles.secondaryButton,
    outline: styles.outlineButton,
    danger: styles.dangerButton,
    success: styles.successButton,
    muted: styles.mutedButton,
  }[variant];
  const contentColor = variant === 'outline' ? colors.text : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.82 },
        style,
      ]}
    >
      <View style={styles.buttonContent}>
        {!!Icon && <Icon size={16} color={contentColor} strokeWidth={2.5} />}
        <Text style={[styles.buttonText, { color: contentColor }, textStyle]}>{title}</Text>
      </View>
    </Pressable>
  );
};

export const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  autoCapitalize = 'none',
}) => (
  <View style={{ marginBottom: spacing.md }}>
    {!!label && <Text style={commonStyles.label}>{label}</Text>}
    <TextInput
      value={String(value ?? '')}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.faint}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      multiline={multiline}
      autoCapitalize={autoCapitalize}
      style={[commonStyles.input, multiline && commonStyles.textarea]}
    />
  </View>
);

export const SelectField = ({ label, selectedValue, onValueChange, items }) => (
  <View style={{ marginBottom: spacing.md }}>
    {!!label && <Text style={commonStyles.label}>{label}</Text>}
    <View style={styles.pickerShell}>
      <Picker
        dropdownIconColor={colors.text}
        selectedValue={selectedValue}
        onValueChange={onValueChange}
        style={styles.picker}
        itemStyle={styles.pickerItem}
      >
        {items.map((item) => (
          <Picker.Item key={item.value} label={item.label} value={item.value} />
        ))}
      </Picker>
    </View>
  </View>
);

export const Badge = ({ children, tone = 'muted', style }) => {
  const toneStyle = {
    muted: { backgroundColor: '#1f2937', color: colors.muted },
    primary: { backgroundColor: 'rgba(29,78,216,0.22)', color: '#bfdbfe' },
    success: { backgroundColor: 'rgba(16,185,129,0.2)', color: '#a7f3d0' },
    warning: { backgroundColor: 'rgba(245,158,11,0.2)', color: '#fde68a' },
    danger: { backgroundColor: 'rgba(239,68,68,0.2)', color: '#fecaca' },
    info: { backgroundColor: 'rgba(6,182,212,0.2)', color: '#a5f3fc' },
    orange: { backgroundColor: 'rgba(249,115,22,0.2)', color: '#fed7aa' },
  }[tone];
  return (
    <Text style={[styles.badge, { backgroundColor: toneStyle.backgroundColor, color: toneStyle.color }, style]}>
      {children}
    </Text>
  );
};

export const Message = ({ children, type = 'info' }) => {
  const config = {
    info: { borderColor: colors.border, backgroundColor: 'rgba(30,41,59,0.7)', color: colors.muted },
    error: { borderColor: 'rgba(239,68,68,0.45)', backgroundColor: 'rgba(239,68,68,0.12)', color: '#fecaca' },
    success: { borderColor: 'rgba(16,185,129,0.45)', backgroundColor: 'rgba(16,185,129,0.12)', color: '#bbf7d0' },
    warning: { borderColor: 'rgba(245,158,11,0.45)', backgroundColor: 'rgba(245,158,11,0.12)', color: '#fde68a' },
  }[type];
  return <Text style={[styles.message, config]}>{children}</Text>;
};

export const EmptyState = ({ title, subtitle }) => (
  <Card style={styles.emptyState}>
    <Text style={styles.emptyTitle}>{title}</Text>
    {!!subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
  </Card>
);

export const LoadingState = ({ title = 'Loading...' }) => (
  <View style={{ padding: spacing.xl, alignItems: 'center' }}>
    <ActivityIndicator color={colors.primary} />
    <Text style={{ marginTop: spacing.sm, color: colors.muted }}>{title}</Text>
  </View>
);

export const SegmentTabs = ({ value, onChange, items }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={styles.segmentScroller}
    contentContainerStyle={styles.segmentWrap}
  >
    {items.map((item) => {
      const active = value === item.value;
      return (
        <Pressable
          key={item.value}
          onPress={() => onChange(item.value)}
          style={[styles.segment, active && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{item.label}</Text>
        </Pressable>
      );
    })}
  </ScrollView>
);

export const AppModal = ({ visible, title, onClose, children }) => (
  <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <View style={styles.modalCard}>
        <View style={commonStyles.between}>
          <Text style={commonStyles.h2}>{title}</Text>
          <AppButton title="Close" variant="outline" onPress={onClose} style={{ paddingVertical: 7 }} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: spacing.md }}>
          {children}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

export const Divider = () => <View style={{ height: 1, backgroundColor: colors.mutedBorder, marginVertical: spacing.lg }} />;

const styles = StyleSheet.create({
  button: {
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
  },
  dangerButton: {
    backgroundColor: colors.danger,
  },
  successButton: {
    backgroundColor: colors.success,
  },
  mutedButton: {
    backgroundColor: colors.panel,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  disabled: {
    opacity: 0.48,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  pickerShell: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: '#020617',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: {
    color: colors.text,
    backgroundColor: '#020617',
  },
  pickerItem: {
    color: colors.text,
    backgroundColor: '#020617',
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  message: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    minHeight: 72,
  },
  emptyTitle: {
    color: colors.muted,
    textAlign: 'center',
    fontWeight: '700',
  },
  emptySubtitle: {
    color: colors.faint,
    textAlign: 'center',
    marginTop: spacing.xs,
    fontSize: 12,
    lineHeight: 17,
  },
  segmentScroller: {
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 52,
    marginBottom: spacing.md,
  },
  segmentWrap: {
    gap: spacing.sm,
    alignItems: 'center',
    paddingRight: spacing.md,
  },
  segment: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: 'rgba(29,78,216,0.22)',
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 13,
  },
  segmentTextActive: {
    color: colors.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.86)',
    padding: spacing.lg,
    justifyContent: 'center',
  },
  modalCard: {
    maxHeight: '90%',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
});
