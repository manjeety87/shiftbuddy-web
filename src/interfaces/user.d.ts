
/** A spot on the map plus its human-readable address. */
export interface Place {
    address: string;
    latitude: number;
    longitude: number;
}

export type CommuteMode = 'TRANSIT' | 'DRIVING';

export interface User {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    isEmailVerified: boolean;
    hasPassword: boolean;
    signInMethods: { google: boolean; apple: boolean };
    taxDeductionPercent: number;
    homeLocation: Place | null; // travel time home ↔ job ke liye
    commuteMode: CommuteMode; // how travel time between places is worked out
    arrivalBufferMinutes: number; // how early to aim to arrive at a shift (0 = on time)
}

/** A browser never receives the refresh token: the backend keeps it in an httpOnly cookie. */
export interface AuthResponse {
    user: User;
    accessToken: string;
}