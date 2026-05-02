import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';
import { colors, spacing } from '../theme';
import { toInputDateTime, toIsoOrUndefined } from '../utils/format';
import { useGeolocation } from '../hooks/useGeolocation';
import { AppButton, Field, Message, SelectField, SegmentTabs } from './ui';

const emptyForm = () => ({
  title: '',
  description: '',
  price: '0',
  category: 'physical',
  condition: 'good',
  listingType: 'buy-now',
  tags: '',
  auction: { startBid: '0', endTime: '' },
  rental: {
    ratePerDay: '0',
    securityDeposit: '0',
    availableFrom: '',
    availableUntil: '',
    minimumDays: '1',
  },
});

const mapListing = (listing) => ({
  title: listing?.title || '',
  description: listing?.description || '',
  price: String(listing?.price ?? 0),
  category: listing?.category || 'physical',
  condition: listing?.condition || 'good',
  listingType: listing?.listingType || 'buy-now',
  tags: Array.isArray(listing?.tags) ? listing.tags.join(', ') : listing?.tags || '',
  auction: {
    startBid: String(listing?.auction?.startBid ?? 0),
    endTime: toInputDateTime(listing?.auction?.endTime),
  },
  rental: {
    ratePerDay: String(listing?.rental?.ratePerDay ?? listing?.price ?? 0),
    securityDeposit: String(listing?.rental?.securityDeposit ?? 0),
    availableFrom: toInputDateTime(listing?.rental?.availableFrom),
    availableUntil: toInputDateTime(listing?.rental?.availableUntil),
    minimumDays: String(listing?.rental?.minimumDays ?? 1),
  },
});

const ListingForm = ({ mode = 'create', initialData, allowRental = true, forceListingType, submitLabel, onSuccess }) => {
  const [form, setForm] = useState(initialData ? mapListing(initialData) : emptyForm());
  const [image, setImage] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locationMode, setLocationMode] = useState('auto');
  const [manualLocation, setManualLocation] = useState({
    latitude: '',
    longitude: '',
    address: '',
  });
  const { getCurrentLocation } = useGeolocation();

  useEffect(() => {
    setForm(initialData ? mapListing(initialData) : emptyForm());
  }, [initialData?._id]);

  useEffect(() => {
    if (forceListingType) {
      setForm((prev) => ({ ...prev, listingType: forceListingType }));
    }
  }, [forceListingType]);

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const patchNested = (group, key, value) => {
    setForm((prev) => {
      const next = { ...prev, [group]: { ...prev[group], [key]: value } };
      if (group === 'auction' && key === 'startBid') next.price = value;
      if (group === 'rental' && key === 'ratePerDay') next.price = value;
      return next;
    });
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to upload listing images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.82,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const buildPayload = async () => {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      price: Number(form.price) || 0,
      category: form.category,
      condition: form.condition,
      listingType: forceListingType || form.listingType,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    };

    if (payload.listingType === 'auction') {
      payload.auction = {
        isAuction: true,
        startBid: Number(form.auction.startBid) || 0,
        endTime: toIsoOrUndefined(form.auction.endTime),
      };
      payload.price = payload.auction.startBid;
    }

    if (payload.listingType === 'rental') {
      payload.rental = {
        ratePerDay: Number(form.rental.ratePerDay) || 0,
        securityDeposit: Number(form.rental.securityDeposit) || 0,
        availableFrom: toIsoOrUndefined(form.rental.availableFrom),
        availableUntil: toIsoOrUndefined(form.rental.availableUntil),
        minimumDays: Number(form.rental.minimumDays) || 1,
      };
      payload.price = payload.rental.ratePerDay;
    }

    let location = null;
    if (locationMode === 'manual') {
      const latitude = Number(manualLocation.latitude);
      const longitude = Number(manualLocation.longitude);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        location = {
          latitude,
          longitude,
          address: manualLocation.address,
          source: 'manual',
        };
      }
    } else {
      location = await getCurrentLocation();
    }
    if (location) payload.location = location;
    return payload;
  };

  const uploadImage = async (listingId) => {
    if (!image) return;
    const data = new FormData();
    data.append('image', {
      uri: image.uri,
      name: image.fileName || `listing-${Date.now()}.jpg`,
      type: image.mimeType || 'image/jpeg',
    });
    await api.post(`/listings/${listingId}/images`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const payload = await buildPayload();
      let response;
      if (mode === 'edit' && initialData?._id) {
        if (image) {
          const data = new FormData();
          Object.entries(payload).forEach(([key, value]) => {
            // Skip null/undefined values
            if (value === null || value === undefined) return;
            
            if (Array.isArray(value)) {
              data.append(key, value.join(','));
            } else if (typeof value === 'object') {
              // Always stringify objects for FormData, even if they look nested
              const stringified = JSON.stringify(value);
              data.append(key, stringified);
            } else {
              data.append(key, String(value));
            }
          });
          data.append('images', {
            uri: image.uri,
            name: image.fileName || `listing-${Date.now()}.jpg`,
            type: image.mimeType || 'image/jpeg',
          });
          response = await api.put(`/listings/${initialData._id}`, data, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } else {
          response = await api.put(`/listings/${initialData._id}`, payload);
        }
      } else {
        response = await api.post('/listings', payload);
        await uploadImage(response.data._id);
        setForm(emptyForm());
        setImage(null);
      }
      onSuccess?.(response?.data);
    } catch (err) {
      const validationErrors = err.response?.data?.errors;
      if (Array.isArray(validationErrors) && validationErrors.length) {
        setError(validationErrors.map((issue) => issue.msg || issue.message || issue.param).filter(Boolean).join('. '));
      } else {
        setError(err.response?.data?.message || (mode === 'edit' ? 'Failed to update listing.' : 'Failed to create listing.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const listingTypeItems = [
    { value: 'buy-now', label: 'Buy Now' },
    { value: 'offer', label: 'Offer' },
    { value: 'auction', label: 'Auction' },
  ];
  if (allowRental) listingTypeItems.push({ value: 'rental', label: 'Rental' });

  return (
    <View style={{ gap: spacing.md }}>
      {!!error && <Message type="error">{error}</Message>}
      <Field label="Title" value={form.title} onChangeText={(v) => patch('title', v)} autoCapitalize="sentences" />
      <Field label="Description" value={form.description} onChangeText={(v) => patch('description', v)} multiline autoCapitalize="sentences" />
      <SelectField
        label="Listing Type"
        selectedValue={forceListingType || form.listingType}
        onValueChange={(v) => patch('listingType', v)}
        items={listingTypeItems}
      />
      {(forceListingType || form.listingType) !== 'auction' && (
        <Field
          label={(forceListingType || form.listingType) === 'rental' ? 'Rate per day (INR)' : 'Price (INR)'}
          value={(forceListingType || form.listingType) === 'rental' ? form.rental.ratePerDay : form.price}
          onChangeText={(v) => ((forceListingType || form.listingType) === 'rental' ? patchNested('rental', 'ratePerDay', v) : patch('price', v))}
          keyboardType="numeric"
        />
      )}
      <SelectField
        label="Category"
        selectedValue={form.category}
        onValueChange={(v) => patch('category', v)}
        items={[
          { value: 'physical', label: 'Physical' },
          { value: 'digital', label: 'Digital' },
          { value: 'ticket', label: 'Ticket' },
          { value: 'merch', label: 'Merch' },
        ]}
      />
      <SelectField
        label="Condition"
        selectedValue={form.condition}
        onValueChange={(v) => patch('condition', v)}
        items={[
          { value: 'new', label: 'New' },
          { value: 'like-new', label: 'Like New' },
          { value: 'good', label: 'Good' },
          { value: 'fair', label: 'Fair' },
          { value: 'poor', label: 'Poor' },
        ]}
      />

      {(forceListingType || form.listingType) === 'auction' && (
        <View style={styles.panel}>
          <Field label="Starting bid (INR)" value={form.auction.startBid} onChangeText={(v) => patchNested('auction', 'startBid', v)} keyboardType="numeric" />
          <Field label="End time" value={form.auction.endTime} onChangeText={(v) => patchNested('auction', 'endTime', v)} placeholder="2026-05-05T18:30" />
        </View>
      )}

      {(forceListingType || form.listingType) === 'rental' && (
        <View style={styles.panel}>
          <Field label="Security deposit (INR)" value={form.rental.securityDeposit} onChangeText={(v) => patchNested('rental', 'securityDeposit', v)} keyboardType="numeric" />
          <Field label="Available from" value={form.rental.availableFrom} onChangeText={(v) => patchNested('rental', 'availableFrom', v)} placeholder="2026-05-05T09:00" />
          <Field label="Available until" value={form.rental.availableUntil} onChangeText={(v) => patchNested('rental', 'availableUntil', v)} placeholder="2026-05-10T18:00" />
          <Field label="Minimum days" value={form.rental.minimumDays} onChangeText={(v) => patchNested('rental', 'minimumDays', v)} keyboardType="numeric" />
        </View>
      )}

      <Field label="Tags" value={form.tags} onChangeText={(v) => patch('tags', v)} placeholder="books, hostel, event" autoCapitalize="sentences" />

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

      <Pressable onPress={pickImage} style={styles.imagePicker}>
        {image ? <Image source={{ uri: image.uri }} style={styles.preview} /> : <Text style={{ color: colors.muted }}>Tap to choose listing image</Text>}
      </Pressable>

      <AppButton title={submitting ? 'Submitting...' : submitLabel || (mode === 'edit' ? 'Update Listing' : 'Create Listing')} onPress={submit} disabled={submitting} />
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
  imagePicker: {
    minHeight: 150,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: 170,
  },
});

export default ListingForm;

