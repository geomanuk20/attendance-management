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

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocation is not supported by your browser.');
  }

  const queryPosition = (options: PositionOptions): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  };

  try {
    // Stage 1: Attempt fine / high-accuracy GPS (5s timeout)
    const pos = await queryPosition({
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 10000,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
  } catch (err: any) {
    // If the user or system explicitly blocked permission, don't wait on fallback
    if (err.code === 1 /* PERMISSION_DENIED */) {
      throw new Error(
        'Location access blocked. Please click the lock/tune icon in the browser address bar to allow Location, and ensure macOS / Windows Location Services is enabled for your browser.'
      );
    }

    // Stage 2: Fallback to standard network / Wi-Fi triangulation (15s timeout, allows cached fixes)
    // This allows Mac/PC laptops and desktops without dedicated satellite GPS hardware to resolve location immediately.
    try {
      const pos = await queryPosition({
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60000,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch (fallbackErr: any) {
      if (fallbackErr.code === 1 /* PERMISSION_DENIED */) {
        throw new Error(
          'Location access blocked. Please allow Location in your browser address bar and OS Location Settings.'
        );
      } else if (fallbackErr.code === 2 /* POSITION_UNAVAILABLE */) {
        throw new Error(
          'Location unavailable. Please verify Wi-Fi/Internet is connected and Location Services are active.'
        );
      } else if (fallbackErr.code === 3 /* TIMEOUT */) {
        throw new Error('Location detection timed out. Please check your network connection and retry.');
      } else {
        throw new Error(fallbackErr.message || 'Unable to retrieve location.');
      }
    }
  }
};
