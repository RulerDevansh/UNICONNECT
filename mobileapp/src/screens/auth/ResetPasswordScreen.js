import { useState } from 'react';
import { Text } from 'react-native';
import { forgotPassword, resetPassword } from '../../services/authService';
import { AppButton, Card, Field, Message, Screen, Title } from '../../components/ui';
import { colors, spacing } from '../../theme';

const ResetPasswordScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState(route.params?.email || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await resetPassword({ email, code, newPassword });
      setMessage(res.data.message || 'Password reset.');
      setTimeout(() => navigation.navigate('Login'), 900);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email) {
      setError('Please enter your email first.');
      return;
    }
    setError('');
    const res = await forgotPassword({ email });
    setMessage(res.data.message || 'New code sent.');
  };

  return (
    <Screen>
      <Title subtitle="Enter the code and choose a new password.">Reset your password</Title>
      <Card>
        {!!message && <Message type="success">{message}</Message>}
        {!!error && <Message type="error">{error}</Message>}
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field label="6 digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" />
        <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
        <AppButton title={loading ? 'Resetting...' : 'Reset Password'} onPress={submit} disabled={loading} />
        <Text style={{ color: colors.muted, marginTop: spacing.md }}>
          Need another code? <Text style={{ color: colors.primary, fontWeight: '800' }} onPress={resend}>Resend code</Text>
        </Text>
      </Card>
    </Screen>
  );
};

export default ResetPasswordScreen;

