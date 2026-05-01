import { useEffect, useState } from 'react';
import ListingCard from './ListingCard';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const hasCoordinates = (location) => location?.latitude != null && location?.longitude != null;

const NearestProducts = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const fetchNearestProducts = async () => {
      // Only fetch if user has location
      if (!hasCoordinates(user?.location)) {
        return;
      }

      try {
        setLoading(true);
        setAvailable(true);

        const response = await api.get('/recommendations/nearby', {
          params: {
            maxDistanceKm: 10,
            limit: 6,
          },
        });

        if (response.data?.success && response.data?.data?.listings) {
          setListings(response.data.data.listings);
        } else {
          setListings([]);
        }
      } catch {
        // Silent failure - ML service unavailable (graceful degradation)
        setAvailable(false);
        setListings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNearestProducts();
  }, [user]);

  if (!hasCoordinates(user?.location) || !available) {
    return null;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Nearest Listings</h2>
      {loading ? (
        <p className="text-sm text-slate-400">Loading nearby products…</p>
      ) : listings.length === 0 ? (
        <p className="text-sm text-slate-400">No nearby products yet.</p>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => (
            <ListingCard key={listing._id} listing={listing} compactButtons />
          ))}
        </div>
      )}
    </div>
  );
};

export default NearestProducts;
