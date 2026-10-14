type Coords = { lat: number; lng: number };

/** Google Maps directions in a new tab. Without an origin it starts from wherever the person is. */
export const directionsUrl = (dest: Coords, mode: "driving" | "transit", origin?: Coords) =>
  `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}&travelmode=${mode}` +
  (origin ? `&origin=${origin.lat},${origin.lng}` : "");
