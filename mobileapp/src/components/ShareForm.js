import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import api from '../services/api';
import { colors, spacing } from '../theme';
import { toIsoOrUndefined } from '../utils/format';
import { useGeolocation } from '../hooks/useGeolocation';
import { AppButton, Field, Message, SelectField, SegmentTabs } from './ui';

export const defaultShareForm = {
  name: '',
  description: '',
  shareType: 'cab',
  fromCity: '',
  toCity: '',
  departureTime: '',
  arrivalTime: '',
  bookingDeadline: '',
  maxPassengers: '4',
  vehicleType: '',
  foodItems: '',
  quantity: '1',
  minPersons: '2',
  maxPersons: '10',
  deadlineTime: '',
  category: '',
  otherMinPersons: '2',
  otherMaxPersons: '10',
  otherDeadline: '',
  totalAmount: '0',
  splitType: 'equal',
  hostContribution: '0',
};

export const mapShareToForm = (share = {}) => ({
  ...defaultShareForm,
  name: share.name || '',
  description: share.description || '',
  shareType: share.shareType || 'cab',
  fromCity: share.fromCity || '',
  toCity: share.toCity || '',
  departureTime: share.departureTime ? new Date(share.departureTime).toISOString().slice(0, 16) : '',
  arrivalTime: share.arrivalTime ? new Date(share.arrivalTime).toISOString().slice(0, 16) : '',
  bookingDeadline: share.bookingDeadline ? new Date(share.bookingDeadline).toISOString().slice(0, 16) : '',
  maxPassengers: String(share.maxPassengers ?? 4),
  vehicleType: share.vehicleType || '',
  foodItems: share.foodItems || '',
  quantity: String(share.quantity ?? 1),
  minPersons: String(share.minPersons ?? 2),
  maxPersons: String(share.maxPersons ?? 10),
  deadlineTime: share.deadlineTime ? new Date(share.deadlineTime).toISOString().slice(0, 16) : '',
  category: share.category || '',
  otherMinPersons: String(share.otherMinPersons ?? 2),
  otherMaxPersons: String(share.otherMaxPersons ?? 10),
  otherDeadline: share.otherDeadline ? new Date(share.otherDeadline).toISOString().slice(0, 16) : '',
  totalAmount: String(share.totalAmount ?? 0),
  splitType: share.splitType || 'equal',
  hostContribution: String(share.hostContribution ?? 0),
});

const numericFields = new Set([
  'maxPassengers',
  'quantity',
  'minPersons',
  'maxPersons',
  'otherMinPersons',
  'otherMaxPersons',
  'totalAmount',
  'hostContribution',
]);

const dateFields = new Set(['departureTime', 'arrivalTime', 'bookingDeadline', 'deadlineTime', 'otherDeadline']);

const buildPayload = (form, location) => {
  const payload = {};
  Object.entries(form).forEach(([key, value]) => {
    if (numericFields.has(key)) payload[key] = Number(value) || 0;
    else if (dateFields.has(key)) payload[key] = toIsoOrUndefined(value);
    else payload[key] = value;
  });
  if (location) payload.location = location;
  return payload;
};

const ShareForm = ({ initialData, mode = 'create', onSuccess }) => {
  const [form, setForm] = useState(initialData ? mapShareToForm(initialData) : defaultShareForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locationMode, setLocationMode] = useState('auto');
  const [manualLocation, setManualLocation] = useState({ latitude: '', longitude: '', address: '' });
  const { getCurrentLocation } = useGeolocation();

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      let location = null;
      if (locationMode === 'manual') {
        const latitude = Number(manualLocation.latitude);
        const longitude = Number(manualLocation.longitude);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          location = { latitude, longitude, address: manualLocation.address, source: 'manual' };
        }
      } else {
        location = await getCurrentLocation();
      }
      const payload = buildPayload(form, location);
      if (mode === 'edit' && initialData?._id) {
        await api.put(`/shares/${initialData._id}`, payload);
      } else {
        await api.post('/shares', payload);
        setForm(defaultShareForm);
      }
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${mode === 'edit' ? 'update' : 'create'} share.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      {!!error && <Message type="error">{error}</Message>}
      <SelectField
        label="Type of sharing"
        selectedValue={form.shareType}
        onValueChange={(v) => patch('shareType', v)}
        items={[
          { value: 'cab', label: 'Cab Sharing' },
          { value: 'food', label: 'Food Sharing' },
          { value: 'other', label: 'Other Sharing' },
        ]}
      />
      <Field label="Name" value={form.name} onChangeText={(v) => patch('name', v)} autoCapitalize="sentences" />
      <Field label="Description" value={form.description} onChangeText={(v) => patch('description', v)} multiline autoCapitalize="sentences" />

      {form.shareType === 'cab' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Cab Details</Text>
          <Field label="From city" value={form.fromCity} onChangeText={(v) => patch('fromCity', v)} autoCapitalize="words" />
          <Field label="To city" value={form.toCity} onChangeText={(v) => patch('toCity', v)} autoCapitalize="words" />
          <Field label="Departure time" value={form.departureTime} onChangeText={(v) => patch('departureTime', v)} placeholder="2026-05-05T09:00" />
          <Field label="Arrival time" value={form.arrivalTime} onChangeText={(v) => patch('arrivalTime', v)} placeholder="2026-05-05T11:30" />
          <Field label="Booking deadline" value={form.bookingDeadline} onChangeText={(v) => patch('bookingDeadline', v)} placeholder="2026-05-04T20:00" />
          <Field label="Max passengers" value={form.maxPassengers} onChangeText={(v) => patch('maxPassengers', v)} keyboardType="numeric" />
          <Field label="Vehicle type" value={form.vehicleType} onChangeText={(v) => patch('vehicleType', v)} autoCapitalize="words" />
        </View>
      )}

      {form.shareType === 'food' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Food Details</Text>
          <Field label="Food items" value={form.foodItems} onChangeText={(v) => patch('foodItems', v)} autoCapitalize="sentences" />
          <Field label="Quantity" value={form.quantity} onChangeText={(v) => patch('quantity', v)} keyboardType="numeric" />
          <Field label="Min persons" value={form.minPersons} onChangeText={(v) => patch('minPersons', v)} keyboardType="numeric" />
          <Field label="Max persons" value={form.maxPersons} onChangeText={(v) => patch('maxPersons', v)} keyboardType="numeric" />
          <Field label="Delivery time" value={form.deadlineTime} onChangeText={(v) => patch('deadlineTime', v)} placeholder="2026-05-05T20:00" />
        </View>
      )}

      {form.shareType === 'other' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Share Details</Text>
          <SelectField
            label="Category"
            selectedValue={form.category}
            onValueChange={(v) => patch('category', v)}
            items={[
              { value: '', label: 'Select Category' },
              { value: 'Physical', label: 'Physical' },
              { value: 'Digital', label: 'Digital' },
              { value: 'Ticket', label: 'Ticket' },
              { value: 'Merch', label: 'Merch' },
            ]}
          />
          <Field label="Min persons" value={form.otherMinPersons} onChangeText={(v) => patch('otherMinPersons', v)} keyboardType="numeric" />
          <Field label="Max persons" value={form.otherMaxPersons} onChangeText={(v) => patch('otherMaxPersons', v)} keyboardType="numeric" />
          <Field label="Deadline" value={form.otherDeadline} onChangeText={(v) => patch('otherDeadline', v)} placeholder="2026-05-05T20:00" />
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Payment Details</Text>
        <Field label="Total amount" value={form.totalAmount} onChangeText={(v) => patch('totalAmount', v)} keyboardType="numeric" />
        <SelectField
          label="Split type"
          selectedValue={form.splitType}
          onValueChange={(v) => patch('splitType', v)}
          items={[
            { value: 'equal', label: 'Equal' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        {form.splitType === 'custom' && (
          <Field label="Host contribution" value={form.hostContribution} onChangeText={(v) => patch('hostContribution', v)} keyboardType="numeric" />
        )}
      </View>

      {mode === 'create' && (
        <>
          <Text style={{ color: colors.muted, fontWeight: '800' }}>Location</Text>
          <SegmentTabs
            value={locationMode}
            onChange={setLocationMode}
            items={[
              { value: 'auto', label: 'Use Current' },
              { value: 'manual', label: 'Enter Manually' },
            ]}
          />
          {locationMode === 'manual' && (
            <View style={styles.panel}>
              <Field label="Latitude" value={manualLocation.latitude} keyboardType="numeric" onChangeText={(v) => setManualLocation((prev) => ({ ...prev, latitude: v }))} />
              <Field label="Longitude" value={manualLocation.longitude} keyboardType="numeric" onChangeText={(v) => setManualLocation((prev) => ({ ...prev, longitude: v }))} />
              <Field label="Address" value={manualLocation.address} onChangeText={(v) => setManualLocation((prev) => ({ ...prev, address: v }))} autoCapitalize="sentences" />
            </View>
          )}
        </>
      )}

      <AppButton title={submitting ? 'Saving...' : mode === 'edit' ? 'Update Share' : 'Create Share'} onPress={submit} disabled={submitting} />
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.mutedBorder,
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: 'rgba(2,6,23,0.45)',
  },
  panelTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
});

export default ShareForm;

