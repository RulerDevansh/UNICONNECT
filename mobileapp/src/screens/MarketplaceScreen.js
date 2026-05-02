import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Search } from 'lucide-react-native';
import api from '../services/api';
import ListingCard from '../components/ListingCard';
import { AppButton, EmptyState, Field, LoadingState, Screen, SelectField, Title } from '../components/ui';
import { spacing } from '../theme';

const MarketplaceScreen = ({ navigation, route }) => {
  const [listings, setListings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('');
  const [listingType, setListingType] = useState(route.params?.listingType || '');
  const [loading, setLoading] = useState(true);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery) params.q = searchQuery;
      if (category) params.category = category;
      if (listingType) params.listingType = listingType;
      const { data } = await api.get('/listings', { params });
      setListings(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, category, listingType]);

  useFocusEffect(useCallback(() => { loadListings(); }, [loadListings]));

  return (
    <Screen>
      <Title subtitle="Search every listing in one focused view.">Marketplace</Title>
      <Field label="Search listings" value={searchQuery} onChangeText={setSearchQuery} autoCapitalize="sentences" />
      <SelectField
        label="Category"
        selectedValue={category}
        onValueChange={setCategory}
        items={[
          { value: '', label: 'All Categories' },
          { value: 'physical', label: 'Physical' },
          { value: 'digital', label: 'Digital' },
          { value: 'ticket', label: 'Ticket' },
          { value: 'merch', label: 'Merch' },
        ]}
      />
      <SelectField
        label="Listing type"
        selectedValue={listingType}
        onValueChange={setListingType}
        items={[
          { value: '', label: 'All Types' },
          { value: 'buy-now', label: 'Buy Now' },
          { value: 'offer', label: 'Offer' },
          { value: 'auction', label: 'Auction' },
          { value: 'rental', label: 'Rental' },
        ]}
      />
      <AppButton title="Search" icon={Search} onPress={loadListings} style={{ marginBottom: spacing.lg }} />
      {loading ? <LoadingState title="Loading listings..." /> : listings.length ? (
        listings.map((listing) => (
          <ListingCard key={listing._id} listing={listing} onView={(item) => navigation.navigate('ListingDetail', { id: item._id })} onChanged={loadListings} />
        ))
      ) : (
        <EmptyState title="No listings match those filters." />
      )}
    </Screen>
  );
};

export default MarketplaceScreen;
