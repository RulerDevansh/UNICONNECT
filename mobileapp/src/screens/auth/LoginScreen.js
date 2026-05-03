import { useState } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Card, AppButton, Field, Message, Screen, Title } from '../../components/ui';
import { colors, spacing } from '../../theme';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await login(form);
      const parent = navigation.getParent?.();
      if (parent) {
        parent.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Invalid credentials.';
      if (err.response?.status === 403 && message.toLowerCase().includes('verify')) {
        navigation.navigate('VerifyEmail', { email: form.email });
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Sign in with the email you used during registration.">Welcome back</Title>
      <Card>
        {!!error && <Message type="error">{error}</Message>}
        <Field label="Email" value={form.email} onChangeText={(v) => setForm((prev) => ({ ...prev, email: v }))} keyboardType="email-address" />
        <Field label="Password" value={form.password} onChangeText={(v) => setForm((prev) => ({ ...prev, password: v }))} secureTextEntry />
        <AppButton title={submitting ? 'Logging in...' : 'Login'} onPress={submit} disabled={submitting} />
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Text style={{ color: colors.muted }} onPress={() => navigation.navigate('ForgotPassword')}>Forgot password?</Text>
          <Text style={{ color: colors.muted }}>
            No account? <Text style={{ color: colors.primary, fontWeight: '800' }} onPress={() => navigation.navigate('Register')}>Create one</Text>
          </Text>
        </View>
      </Card>
    </Screen>
  );
};

export default LoginScreen;
