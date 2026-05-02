import { useNavigate } from 'react-router-dom';
import ListingForm from '../components/ListingForm';

const CreateRental = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate('/my-listings', { state: { toast: 'Rental listing created successfully!' } });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10 text-slate-100">
      <h1 className="text-2xl sm:text-4xl font-semibold text-white">Create Rental</h1>
      <p className="mt-2 text-sm text-slate-400">Set rental pricing, availability, and deposit details.</p>
      <ListingForm
        onSuccess={handleSuccess}
        forceListingType="rental"
        submitLabel="Create Rental"
      />
    </main>
  );
};

export default CreateRental;
