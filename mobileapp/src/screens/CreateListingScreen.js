import ListingForm from '../components/ListingForm';
import { Screen, Title } from '../components/ui';
import { useToast } from '../context/ToastContext';

const CreateListingScreen = ({ navigation }) => {
  const { pushToast } = useToast();
  return (
    <Screen>
      <Title subtitle="Moderation runs automatically; flagged items go to admins.">Create Listing</Title>
      <ListingForm
        allowRental={false}
        onSuccess={() => {
          pushToast('Listing created successfully.', { type: 'success' });
          navigation.navigate('MyListings');
        }}
      />
    </Screen>
  );
};

export default CreateListingScreen;

