import { useNavigate } from 'react-router-dom';
import ListingForm from '../components/ListingForm';

const CreateListing = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate('/my-listings', { state: { toast: 'Listing created successfully!' } });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-slate-100">
      <h1 className="text-4xl font-semibold text-white">Create Listing</h1>
      <p className="mt-2 text-sm text-slate-400">Moderation runs automatically; flagged items go to admins.</p>
      <ListingForm onSuccess={handleSuccess} />
    </main>
  );
};

export default CreateListing;
