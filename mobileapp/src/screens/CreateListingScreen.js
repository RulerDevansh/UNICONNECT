import { Alert } from 'react-native';
import ListingForm from '../components/ListingForm';
import { Screen, Title } from '../components/ui';

const CreateListingScreen = ({ navigation }) => (
  <Screen>
    <Title subtitle="Moderation runs automatically; flagged items go to admins.">Create Listing</Title>
    <ListingForm
      allowRental={false}
      onSuccess={() => {
        Alert.alert('Created', 'Listing created successfully.');
        navigation.navigate('MyListings');
      }}
    />
  </Screen>
);

export default CreateListingScreen;

