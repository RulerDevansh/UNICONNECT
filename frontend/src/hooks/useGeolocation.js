import { useState, useCallback } from 'react';

const DEFAULT_DESIRED_ACCURACY_METERS = 200;
const DEFAULT_MAX_ACCEPTABLE_ACCURACY_METERS = 5000;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_WATCH_TIMEOUT_MS = 20000;

const reverseGeocode = async ({ latitude, longitude }) => {
  let address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      address = geoData.display_name || address;
    }
  } catch {
    // Fallback to lat,lon string if geocoding fails.
  }
  return address;
};

/**
 * Custom hook to get user's geolocation using Geolocation API
 * Returns { latitude, longitude, address, accuracy, source, error, loading }
 */
export const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = useCallback(async (options = {}) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return null;
    }

    setLoading(true);
    setError(null);

    const config = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
      maximumAge: options.maximumAge ?? 0,
    };
    const watchForAccuracy = options.watchForAccuracy ?? true;
    const desiredAccuracy = options.desiredAccuracy ?? DEFAULT_DESIRED_ACCURACY_METERS;
    const watchTimeout = options.watchTimeout ?? DEFAULT_WATCH_TIMEOUT_MS;
    const maxAcceptableAccuracy = options.maxAcceptableAccuracy ?? DEFAULT_MAX_ACCEPTABLE_ACCURACY_METERS;
    const allowApproximate = options.allowApproximate ?? false;

    const accuracyError = (accuracy) => {
      const km = Math.round((accuracy || 0) / 100) / 10;
      return `Browser location is too approximate (${km} km). Search your area or choose it on the map.`;
    };

    const isAcceptable = (position) => {
      const accuracy = position?.coords?.accuracy;
      return allowApproximate || !Number.isFinite(accuracy) || accuracy <= maxAcceptableAccuracy;
    };

    const resolvePosition = async (position, resolve) => {
      if (!isAcceptable(position)) {
        const message = accuracyError(position.coords.accuracy);
        setError(message);
        setLoading(false);
        resolve(null);
        return;
      }

      const { latitude, longitude, accuracy } = position.coords;
      const address = await reverseGeocode({ latitude, longitude });
      const locData = {
        latitude,
        longitude,
        address,
        accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
        source: 'browser',
      };
      setLocation(locData);
      setLoading(false);
      resolve(locData);
    };

    return new Promise((resolve) => {
      if (!watchForAccuracy) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            await resolvePosition(position, resolve);
          },
          (err) => {
            setError(err.message || 'Failed to get geolocation');
            setLoading(false);
            resolve(null);
          },
          config
        );
        return;
      }

      let bestPosition = null;
      let watchId = null;
      let timeoutId = null;
      let finalized = false;

      const finalize = async () => {
        if (finalized) return;
        finalized = true;
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        if (bestPosition) {
          await resolvePosition(bestPosition, resolve);
          return;
        }
        setLoading(false);
        resolve(null);
      };

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const currentAccuracy = Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : Infinity;
          const bestAccuracy = Number.isFinite(bestPosition?.coords?.accuracy) ? bestPosition.coords.accuracy : Infinity;
          if (!bestPosition || currentAccuracy < bestAccuracy) {
            bestPosition = position;
          }
          if (position.coords.accuracy <= desiredAccuracy) {
            finalize();
          }
        },
        (err) => {
          setError(err.message || 'Failed to get geolocation');
          finalize();
        },
        config
      );

      timeoutId = setTimeout(() => {
        finalize();
      }, watchTimeout);
    });
  }, []);

  return { location, error, loading, getCurrentLocation };
};
