import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MapPin, Navigation, Save, Store, UsersRound } from 'lucide-react-native';
import api from '../services/api';
import { updateLocation } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { useGeolocation } from '../hooks/useGeolocation';
import ListingCard from '../components/ListingCard';
import ShareCard from '../components/ShareCard';
import { AppButton, Card, EmptyState, Field, LoadingState, Screen, SegmentTabs, Title } from '../components/ui';
import { colors, commonStyles, spacing } from '../theme';
import { getId } from '../utils/id';

const activeShare = (share) => {
  const joined = share.members?.filter((m) => m.status === 'joined').length || 0;
  if (share.shareType === 'cab') {
    return !(share.bookingDeadline && new Date() > new Date(share.bookingDeadline)) && !(share.maxPassengers && joined >= share.maxPassengers);
  }
  if (share.shareType === 'food') {
    return !(share.deadlineTime && new Date() > new Date(share.deadlineTime)) && !(share.maxPersons && joined >= share.maxPersons);
  }
  return !(share.otherDeadline && new Date() > new Date(share.otherDeadline)) && !(share.otherMaxPersons && joined >= share.otherMaxPersons);
};

const hasCoordinates = (location) => location?.latitude != null && location?.longitude != null;
const NEARBY_RADIUS_OPTIONS = [1, 3, 5, 10].map((radius) => ({
  value: radius,
  label: `${radius} km`,
}));

const HomeScreen = ({ navigation }) => {
  const { isAuthenticated, user, refreshProfile } = useAuth();
  const { socket } = useSocket();
  const [listings, setListings] = useState([]);
  const [shares, setShares] = useState([]);
  const [nearestListings, setNearestListings] = useState([]);
  const [nearestShares, setNearestShares] = useState([]);
  const [listingType, setListingType] = useState('');
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState('');
  const [cancellingId, setCancellingId] = useState('');
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(10);
  const [showLocation, setShowLocation] = useState(false);
  const [locationDraft, setLocationDraft] = useState({
    latitude: '',
    longitude: '',
    address: '',
  });
  const { getCurrentLocation } = useGeolocation();
  const { pushToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (listingType) params.listingType = listingType;
      const [listingRes, shareRes] = await Promise.all([
        api.get('/listings', { params }),
        isAuthenticated ? api.get('/shares').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setListings(listingRes.data.data || []);
      setShares((shareRes.data || []).filter(activeShare));
    } finally {
      setLoading(false);
    }
  }, [listingType, isAuthenticated]);

  const loadNearby = useCallback(async () => {
    if (!isAuthenticated || !hasCoordinates(user?.location)) return;
    try {
      const { data } = await api.get('/recommendations/nearby', { params: { maxDistanceKm: nearbyRadiusKm, limit: 6 } });
      if (data?.success) {
        setNearestListings(data.data?.listings || []);
        setNearestShares((data.data?.shares || []).filter(activeShare));
      }
    } catch {
      setNearestListings([]);
      setNearestShares([]);
    }
  }, [isAuthenticated, user?.location, nearbyRadiusKm]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    loadNearby();
  }, [loadNearby]);

  useEffect(() => {
    if (!socket || !isAuthenticated) return undefined;
    const refreshShares = () => {
      load();
      loadNearby();
    };
    const events = ['share:updated', 'share:request', 'share:approved', 'share:rejected', 'share:cancelled', 'share:deleted'];
    events.forEach((event) => socket.on(event, refreshShares));
    return () => events.forEach((event) => socket.off(event, refreshShares));
  }, [socket, isAuthenticated, load, loadNearby]);

  useEffect(() => {
    if (user?.location?.latitude && user?.location?.longitude) {
      setLocationDraft({
        latitude: String(user.location.latitude),
        longitude: String(user.location.longitude),
        address: user.location.address || '',
      });
    }
  }, [user]);

  const saveLocation = async (auto = false) => {
    try {
      let payload;
      if (auto) {
        payload = await getCurrentLocation();
      } else {
        payload = {
          latitude: Number(locationDraft.latitude),
          longitude: Number(locationDraft.longitude),
          address: locationDraft.address,
          source: 'manual',
        };
      }
      if (!payload || !Number.isFinite(payload.latitude) || !Number.isFinite(payload.longitude)) {
        pushToast('Enter valid latitude and longitude.', { type: 'warning' });
        return;
      }
      await updateLocation(payload);
      await refreshProfile();
      setShowLocation(false);
      loadNearby();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Unable to save location.', { type: 'error' });
    }
  };

  const refreshShares = async () => {
    await Promise.all([load(), loadNearby()]);
  };

  const joinShare = async (shareId) => {
    setJoiningId(shareId);
    try {
      await api.post(`/shares/${shareId}/join`);
      pushToast('Join request submitted.', { type: 'success' });
      await refreshShares();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to request join.', { type: 'error' });
    } finally {
      setJoiningId('');
    }
  };

  const cancelShare = async (shareId) => {
    setCancellingId(shareId);
    try {
      await api.post(`/shares/${shareId}/cancel`);
      pushToast('Booking cancelled successfully.', { type: 'success' });
      await refreshShares();
    } catch (err) {
      pushToast(err.response?.data?.message || 'Failed to cancel booking.', { type: 'error' });
    } finally {
      setCancellingId('');
    }
  };

  return (
    <Screen>
      <Title subtitle="Everything classmates are selling and splitting, side by side.">Marketplace + Sharing hub</Title>

      {isAuthenticated && (
        <Card style={{ marginBottom: spacing.lg }}>
          <View style={commonStyles.between}>
            <View style={{ flex: 1 }}>
              <Text style={commonStyles.h2}>Location</Text>
              <Text style={commonStyles.muted}>{user?.location?.address || 'Set your location for nearby recommendations.'}</Text>
            </View>
            <AppButton title={showLocation ? 'Close' : 'Set'} icon={MapPin} variant="outline" onPress={() => setShowLocation((prev) => !prev)} />
          </View>
          {showLocation && (
            <View style={{ marginTop: spacing.md }}>
              <Field label="Latitude" value={locationDraft.latitude} keyboardType="numeric" onChangeText={(v) => setLocationDraft((prev) => ({ ...prev, latitude: v }))} />
              <Field label="Longitude" value={locationDraft.longitude} keyboardType="numeric" onChangeText={(v) => setLocationDraft((prev) => ({ ...prev, longitude: v }))} />
              <Field label="Address" value={locationDraft.address} onChangeText={(v) => setLocationDraft((prev) => ({ ...prev, address: v }))} autoCapitalize="sentences" />
              <View style={styles.locationActions}>
                <AppButton title="Use Current" icon={Navigation} variant="secondary" onPress={() => saveLocation(true)} style={{ flex: 1 }} />
                <AppButton title="Save Manual" icon={Save} onPress={() => saveLocation(false)} style={{ flex: 1 }} />
              </View>
            </View>
          )}
          {hasCoordinates(user?.location) && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={commonStyles.label}>Nearby radius</Text>
              <SegmentTabs
                value={nearbyRadiusKm}
                onChange={setNearbyRadiusKm}
                items={NEARBY_RADIUS_OPTIONS}
              />
            </View>
          )}
        </Card>
      )}

      {isAuthenticated && hasCoordinates(user?.location) && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={commonStyles.h2}>Nearest Listings</Text>
          <View style={{ marginTop: spacing.md }}>
            {nearestListings.length ? (
              nearestListings.map((listing) => (
                <ListingCard key={listing._id} listing={listing} compact onView={(item) => navigation.navigate('ListingDetail', { id: item._id })} />
              ))
            ) : (
              <Text style={commonStyles.muted}>No listings within {nearbyRadiusKm} km yet.</Text>
            )}
          </View>
        </Card>
      )}

      {isAuthenticated && hasCoordinates(user?.location) && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={commonStyles.h2}>Nearest Shares</Text>
          <View style={{ marginTop: spacing.md }}>
            {nearestShares.length ? (
              nearestShares.map((share) => (
                <ShareCard
                  key={share._id}
                  share={share}
                  currentUserId={getId(user)}
                  onJoin={joinShare}
                  onCancel={cancelShare}
                  joiningId={joiningId}
                  cancellingId={cancellingId}
                />
              ))
            ) : (
              <Text style={commonStyles.muted}>No shares within {nearbyRadiusKm} km yet.</Text>
            )}
          </View>
        </Card>
      )}

      <View style={styles.sectionHead}>
        <View>
          <Text style={styles.eyebrow}>Marketplace</Text>
          <Text style={commonStyles.h2}>Live Listings</Text>
        </View>
        <AppButton title="Marketplace" icon={Store} variant="outline" onPress={() => navigation.navigate('Marketplace')} />
      </View>
      <SegmentTabs
        value={listingType}
        onChange={setListingType}
        items={[
          { value: '', label: 'All Listings' },
          { value: 'rental', label: 'Rental Only' },
        ]}
      />
      {loading ? <LoadingState title="Loading listings..." /> : listings.length ? (
        listings.map((listing) => <ListingCard key={listing._id} listing={listing} compact onView={(item) => navigation.navigate('ListingDetail', { id: item._id })} onChanged={load} />)
      ) : (
        <EmptyState title={listingType === 'rental' ? 'No rental listings posted yet.' : 'No listings posted yet.'} />
      )}

      <View style={[styles.sectionHead, { marginTop: spacing.xl }]}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.success }]}>Sharing</Text>
          <Text style={commonStyles.h2}>Active Splits</Text>
        </View>
        <AppButton title="Manage" icon={UsersRound} variant="outline" onPress={() => navigation.navigate('Sharing')} />
      </View>
      {isAuthenticated ? (
        shares.length ? shares.map((share) => (
          <ShareCard
            key={share._id}
            share={share}
            currentUserId={getId(user)}
            onJoin={joinShare}
            onCancel={cancelShare}
            joiningId={joiningId}
            cancellingId={cancellingId}
          />
        )) : <EmptyState title="No shares created yet." />
      ) : (
        <EmptyState title="Login to view shares." />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  locationActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  eyebrow: {
    color: colors.secondary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

export default HomeScreen;
