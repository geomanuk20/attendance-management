export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Calculates haversine distance in meters between two coordinates.
 */
export const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Retrieves the current browser location with multi-stage accuracy fallback.
 * Solves laptop/desktop issues where GPS hardware is absent, network timeouts,
 * or macOS location permissions needing clear user guidance.
 */
export const getCurrentLocation = async (): Promise<LocationResult> => {
  if (
    typeof window !== 'undefined' &&
    window.isSecureContext === false &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    throw new Error('Browser requires HTTPS or localhost for location access.');
  }

  const saveCache = (res: LocationResult) => {
    try {
      localStorage.setItem('last_valid_location', JSON.stringify({ ...res, timestamp: Date.now() }));
    } catch {}
  };

  const getCachedLocation = (): LocationResult | null => {
    try {
      const stored = localStorage.getItem('last_valid_location');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
          // Valid within 4 hours
          if (Date.now() - (parsed.timestamp || 0) < 4 * 3600 * 1000) {
            return {
              latitude: parsed.latitude,
              longitude: parsed.longitude,
              accuracy: parsed.accuracy || 150,
            };
          }
        }
      }
    } catch {}
    return null;
  };

  const queryPosition = (options: PositionOptions): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  };

  // Stage 1: Fine / GPS Accuracy (3.5s timeout)
  try {
    const pos = await queryPosition({
      enableHighAccuracy: true,
      timeout: 3500,
      maximumAge: 30000,
    });
    const res: LocationResult = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
    saveCache(res);
    return res;
  } catch {}

  // Stage 2: Standard Network / Wi-Fi Triangulation (5s timeout)
  try {
    const pos = await queryPosition({
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 180000,
    });
    const res: LocationResult = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
    saveCache(res);
    return res;
  } catch {}

  // Stage 3: Fast IP-Based Geolocation Fallback (resolves immediately if macOS Chrome blocks hardware positioning)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const ipRes = await fetch('https://ipwho.is/', { signal: controller.signal });
    clearTimeout(timer);
    if (ipRes.ok) {
      const data = await ipRes.json();
      if (data && data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const res: LocationResult = {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 500,
        };
        saveCache(res);
        return res;
      }
    }
  } catch {}

  // Stage 4: Cached valid location from previous check
  const cached = getCachedLocation();
  if (cached) {
    return cached;
  }

  // If all stages fail, provide clear instructions for macOS Chrome
  throw new Error(
    'Location detection timed out. On Mac: Open System Settings > Privacy & Security > Location Services and turn ON "Google Chrome".'
  );
};
