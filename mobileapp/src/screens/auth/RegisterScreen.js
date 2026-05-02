import { useState } from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { AppButton, Card, Field, Message, Screen, Title } from '../../components/ui';
import { colors, spacing } from '../../theme';

const RegisterScreen = ({ navigation }) => {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await register(form);
      navigation.navigate('VerifyEmail', { email: form.email });
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to register.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Use any email you can access for verification.">Create your account</Title>
      <Card>
        {!!error && <Message type="error">{error}</Message>}
        <Field label="Name" value={form.name} onChangeText={(v) => setForm((prev) => ({ ...prev, name: v }))} autoCapitalize="words" />
        <Field label="Email" value={form.email} onChangeText={(v) => setForm((prev) => ({ ...prev, email: v }))} keyboardType="email-address" />
        <Field label="Password" value={form.password} onChangeText={(v) => setForm((prev) => ({ ...prev, password: v }))} secureTextEntry />
        <AppButton title={submitting ? 'Registering...' : 'Register'} onPress={submit} disabled={submitting} />
        <Text style={{ color: colors.muted, marginTop: spacing.md }}>
          Already registered? <Text style={{ color: colors.primary, fontWeight: '800' }} onPress={() => navigation.navigate('Login')}>Log in</Text>
        </Text>
      </Card>
    </Screen>
  );
};

export default RegisterScreen;

