import { useState } from 'react';
import { Text } from 'react-native';
import { forgotPassword } from '../../services/authService';
import { AppButton, Card, Field, Message, Screen, Title } from '../../components/ui';
import { colors, spacing } from '../../theme';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await forgotPassword({ email });
      setMessage(res.data.message || 'Reset code sent.');
      setTimeout(() => navigation.navigate('ResetPassword', { email }), 900);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Title subtitle="Enter your registered email and we will send a reset code.">Forgot password?</Title>
      <Card>
        {!!message && <Message type="success">{message}</Message>}
        {!!error && <Message type="error">{error}</Message>}
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <AppButton title={loading ? 'Sending...' : 'Send Reset Code'} onPress={submit} disabled={loading} />
        <Text style={{ color: colors.muted, marginTop: spacing.md }}>
          Remembered it? <Text style={{ color: colors.primary, fontWeight: '800' }} onPress={() => navigation.navigate('Login')}>Back to login</Text>
        </Text>
      </Card>
    </Screen>
  );
};

export default ForgotPasswordScreen;

