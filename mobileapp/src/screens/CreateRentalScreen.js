import { Alert } from 'react-native';
import ListingForm from '../components/ListingForm';
import { Screen, Title } from '../components/ui';

const CreateRentalScreen = ({ navigation }) => (
  <Screen>
    <Title subtitle="Set rental pricing, availability, and deposit details.">Create Rental</Title>
    <ListingForm
      forceListingType="rental"
      submitLabel="Create Rental"
      onSuccess={() => {
        Alert.alert('Created', 'Rental listing created successfully.');
        navigation.navigate('MyListings');
      }}
    />
  </Screen>
);

export default CreateRentalScreen;
