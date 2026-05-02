import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

const reverseGeocode = async ({ latitude, longitude }) => {
  try {
    const places = await Location.reverseGeocodeAsync({ latitude, longitude });
    const place = places?.[0];
    if (!place) return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    return [
      place.name,
      place.street,
      place.city || place.district,
      place.region,
      place.postalCode,
      place.country,
    ]
      .filter(Boolean)
      .join(', ');
  } catch {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
};

export const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Location permission was not granted.');
        return null;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude, accuracy } = position.coords;
      const address = await reverseGeocode({ latitude, longitude });
      const payload = {
        latitude,
        longitude,
        accuracy,
        address,
        source: 'browser',
      };
      setLocation(payload);
      return payload;
    } catch (err) {
      setError(err.message || 'Unable to get location.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { location, error, loading, getCurrentLocation };
};

