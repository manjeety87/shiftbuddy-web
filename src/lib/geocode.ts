import type { Place } from '../interfaces/user.d';
import { api } from './api';

// Address lookups go through our backend (Photon for search-as-you-type,
// Nominatim for reverse lookups) — direct calls from the phone get 403s.

/** Places matching a partial query; `near` ranks places around that point first. */
export const searchPlaces = async (query: string, near?: { latitude: number; longitude: number }): Promise<Place[]> => {
    const params = near ? { q: query, lat: near.latitude, lng: near.longitude } : { q: query };
    const { data } = await api.get<{ data: Place[] }>('/geocode/search', { params });
    return data.data;
};

/** "Tim Hortons, 477 Dundas St W, Toronto" → title "Tim Hortons", detail "477 Dundas St W, Toronto". */
export const splitAddress = (address: string) => {
    const comma = address.indexOf(',');
    return comma === -1 ? { title: address, detail: '' } : { title: address.slice(0, comma), detail: address.slice(comma + 1).trim() };
};

export const reverseGeocode = async (latitude: number, longitude: number): Promise<Place> => {
    const { data } = await api.get<{ data: Place }>('/geocode/reverse', { params: { lat: latitude, lng: longitude } });
    return data.data;
};
