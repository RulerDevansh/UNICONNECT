import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ListingForm from '../components/ListingForm';
import api from '../services/api';

const EditListing = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/listings/${id}`);
        setListing(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load listing');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleSuccess = () => {
    navigate('/my-listings', { state: { toast: 'Listing updated successfully.' } });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10 text-slate-100">
      <h1 className="text-2xl sm:text-4xl font-semibold text-white">Edit Listing</h1>
      <p className="mt-2 text-sm text-slate-400">Update details and save changes instantly.</p>
      {loading && <p className="mt-6 text-slate-400">Loading listing…</p>}
      {!loading && error && <p className="mt-6 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
      {!loading && !error && listing && (
        <ListingForm mode="edit" initialData={listing} onSuccess={handleSuccess} />
      )}
    </main>
  );
};

export default EditListing;
