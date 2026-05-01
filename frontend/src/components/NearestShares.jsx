import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import SharePreviewCard from './SharePreviewCard';

const hasCoordinates = (location) => location?.latitude != null && location?.longitude != null;

const NearestShares = () => {
  const { user } = useAuth();
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const fetchNearestShares = async () => {
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

        if (response.data?.success && response.data?.data?.shares) {
          setShares(response.data.data.shares);
        } else {
          setShares([]);
        }
      } catch {
        // Silent failure - ML service unavailable (graceful degradation)
        setAvailable(false);
        setShares([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNearestShares();
  }, [user]);

  if (!hasCoordinates(user?.location) || !available) {
    return null;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Nearest Shares</h2>
      {loading ? (
        <p className="text-sm text-slate-400">Loading nearby shares…</p>
      ) : shares.length === 0 ? (
        <p className="text-sm text-slate-400">No nearby shares yet.</p>
      ) : (
        <div className="space-y-4">
          {shares.map((share) => (
            <div key={share._id}>
              <SharePreviewCard share={share} />
              <div className="mt-3">
                <Link
                  to="/shares"
                  className="inline-flex w-full items-center justify-center rounded-full bg-brand-primary px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-primary/30 transition hover:-translate-y-0.5 hover:bg-brand-secondary"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NearestShares;
