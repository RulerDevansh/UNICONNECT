import { useState } from 'react';
import { Text } from 'react-native';
import { resendVerification, verifyEmail } from '../../services/authService';
import { AppButton, Card, Field, Message, Screen, Title } from '../../components/ui';
import { colors, spacing } from '../../theme';

const VerifyEmailScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState(route.params?.email || '');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizeOtpInput = (value) => {
    const raw = String(value ?? '');
    const matches = raw.match(/\d{6}/g);
    if (matches && matches.length) return matches[matches.length - 1];
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return digits.slice(-6);
  };

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = normalizeOtpInput(code);
    if (!normalizedEmail || !normalizedCode) {
      setError('Both email and code are required.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await verifyEmail({ email: normalizedEmail, code: normalizedCode });
      setMessage(res.data.message || 'Email verified.');
      setTimeout(() => navigation.navigate('Login'), 900);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Please enter your email first.');
      return;
    }
    setError('');
    setMessage('');
    try {
      const res = await resendVerification({ email: normalizedEmail });
      setMessage(res.data.message || 'New code sent.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code.');
    }
  };

  return (
    <Screen>
      <Title subtitle="Enter the six digit code sent to your email.">Verify your email</Title>
      <Card>
        {!!message && <Message type="success">{message}</Message>}
        {!!error && <Message type="error">{error}</Message>}
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field
          label="6 digit code"
          value={code}
          onChangeText={(v) => setCode(normalizeOtpInput(v))}
          keyboardType="number-pad"
        />
        <AppButton title={loading ? 'Verifying...' : 'Verify Email'} onPress={submit} disabled={loading} />
        <Text style={{ color: colors.muted, marginTop: spacing.md }}>
          Did not receive it? <Text style={{ color: colors.primary, fontWeight: '800' }} onPress={resend}>Resend code</Text>
        </Text>
      </Card>
    </Screen>
  );
};

export default VerifyEmailScreen;

