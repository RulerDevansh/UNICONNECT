import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useGeolocation } from '../hooks/useGeolocation';
import { AppButton, Card, Field, LoadingState, Message, Screen, SegmentTabs, Title } from '../components/ui';
import { colors, commonStyles, radius, spacing } from '../theme';
import { formatDate } from '../utils/format';

const ProfileScreen = () => {
  const { refreshProfile, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('details');
  const [name, setName] = useState('');
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [locationDraft, setLocationDraft] = useState({ latitude: '', longitude: '', address: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { pushToast } = useToast();
  const { getCurrentLocation } = useGeolocation();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/me');
      setProfile(data);
      setName(data.name || '');
      if (data.location?.latitude && data.location?.longitude) {
        setLocationDraft({
          latitude: String(data.location.latitude),
          longitude: String(data.location.longitude),
          address: data.location.address || '',
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateProfile = async () => {
    setError('');
    setMessage('');
    try {
      const { data } = await api.put('/users/me', { name });
      setProfile(data);
      await refreshProfile();
      setMessage('Profile updated successfully.');
      setMode('details');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    }
  };

  const changePassword = async () => {
    if (password.newPassword !== password.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (password.newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await api.put('/users/me/password', {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessage('Password changed successfully.');
      setMode('details');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password.');
    }
  };

  const saveLocation = async (auto = false) => {
    setError('');
    setMessage('');
    try {
      const payload = auto
        ? await getCurrentLocation()
        : {
            latitude: Number(locationDraft.latitude),
            longitude: Number(locationDraft.longitude),
            address: locationDraft.address,
            source: 'manual',
          };
      if (!payload || !Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
        pushToast('Enter valid latitude and longitude.', { type: 'warning' });
        return;
      }
      const { data } = await api.post('/users/location', payload);
      setProfile(data);
      await refreshProfile();
      setMessage('Location updated successfully.');
      setMode('details');
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to update location.';
      setError(errMsg);
      pushToast(errMsg, { type: 'error' });
    }
  };

  const initials = profile?.name?.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2) || '?';

  if (loading) return <Screen><LoadingState title="Loading profile..." /></Screen>;
  if (!profile) return <Screen><Message type="error">Profile not found.</Message></Screen>;

  return (
    <Screen>
      <Title subtitle={profile.email}>Profile</Title>
      {!!message && <Message type="success">{message}</Message>}
      {!!error && <Message type="error">{error}</Message>}
      <Card>
        <View style={styles.header}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={commonStyles.muted}>{profile.email}</Text>
          </View>
        </View>
        <SegmentTabs
          value={mode}
          onChange={setMode}
          items={[
            { value: 'details', label: 'Details' },
            { value: 'edit', label: 'Edit' },
            { value: 'password', label: 'Password' },
            { value: 'location', label: 'Location' },
          ]}
        />

        {mode === 'details' && (
          <View style={styles.details}>
            <Row label="Name" value={profile.name} />
            <Row label="Email" value={profile.email} />
            <Row label="Member Since" value={formatDate(profile.createdAt)} />
            <Row label="Location" value={profile.location?.address || 'Not set'} />
            <AppButton title="Logout" variant="danger" onPress={logout} style={{ marginTop: spacing.md }} />
          </View>
        )}

        {mode === 'edit' && (
          <View>
            <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
            <AppButton title="Save Changes" onPress={updateProfile} />
          </View>
        )}

        {mode === 'password' && (
          <View>
            <Field label="Current password" value={password.currentPassword} secureTextEntry onChangeText={(v) => setPassword((prev) => ({ ...prev, currentPassword: v }))} />
            <Field label="New password" value={password.newPassword} secureTextEntry onChangeText={(v) => setPassword((prev) => ({ ...prev, newPassword: v }))} />
            <Field label="Confirm new password" value={password.confirmPassword} secureTextEntry onChangeText={(v) => setPassword((prev) => ({ ...prev, confirmPassword: v }))} />
            <AppButton title="Update Password" variant="success" onPress={changePassword} />
          </View>
        )}

        {mode === 'location' && (
          <View>
            <Field label="Latitude" value={locationDraft.latitude} keyboardType="numeric" onChangeText={(v) => setLocationDraft((prev) => ({ ...prev, latitude: v }))} />
            <Field label="Longitude" value={locationDraft.longitude} keyboardType="numeric" onChangeText={(v) => setLocationDraft((prev) => ({ ...prev, longitude: v }))} />
            <Field label="Address" value={locationDraft.address} onChangeText={(v) => setLocationDraft((prev) => ({ ...prev, address: v }))} autoCapitalize="sentences" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <AppButton title="Use Current" variant="secondary" onPress={() => saveLocation(true)} style={{ flex: 1 }} />
              <AppButton title="Save Manual" onPress={() => saveLocation(false)} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </Card>
    </Screen>
  );
};

const Row = ({ label, value }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  details: {
    gap: spacing.sm,
  },
  row: {
    borderWidth: 1,
    borderColor: colors.mutedBorder,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: 'rgba(2,6,23,0.45)',
  },
  rowLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  rowValue: {
    color: colors.text,
    marginTop: 4,
    fontWeight: '700',
  },
});

export default ProfileScreen;

