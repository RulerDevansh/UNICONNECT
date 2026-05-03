import ListingForm from '../components/ListingForm';
import { Screen, Title } from '../components/ui';
import { useToast } from '../context/ToastContext';

const CreateRentalScreen = ({ navigation }) => {
  const { pushToast } = useToast();
  return (
    <Screen>
      <Title subtitle="Set rental pricing, availability, and deposit details.">Create Rental</Title>
      <ListingForm
        forceListingType="rental"
        submitLabel="Create Rental"
        onSuccess={() => {
          pushToast('Rental listing created successfully.', { type: 'success' });
          navigation.navigate('MyListings');
        }}
      />
    </Screen>
  );
};

export default CreateRentalScreen;
