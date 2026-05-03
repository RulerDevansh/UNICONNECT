import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import ListingForm from '../components/ListingForm';
import { LoadingState, Message, Screen, Title } from '../components/ui';
import { useToast } from '../context/ToastContext';

const EditListingScreen = ({ navigation, route }) => {
  const { id } = route.params || {};
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { pushToast } = useToast();

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/listings/${id}`);
        if (active) setListing(data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Unable to load listing.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [id]));

  return (
    <Screen>
      <Title subtitle="Update details and save changes instantly.">Edit Listing</Title>
      {loading && <LoadingState title="Loading listing..." />}
      {!!error && <Message type="error">{error}</Message>}
      {!loading && listing && (
        <ListingForm
          mode="edit"
          initialData={listing}
          onSuccess={() => {
            pushToast('Listing updated successfully.', { type: 'success' });
            navigation.navigate('MyListings');
          }}
        />
      )}
    </Screen>
  );
};

export default EditListingScreen;

