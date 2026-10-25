
/** A spot on the map plus its human-readable address. */
export interface Place {
    address: string;
    latitude: number;
    longitude: number;
}

export type CommuteMode = 'TRANSIT' | 'DRIVING';

/** Parts of the app switched on or off — the backend fills in every key (constants/features.js) */
export interface Features {
    leaveBy: boolean;
    weather: boolean;
    timesheet: boolean;
    pay: boolean;
    sharedOnHome: boolean;
    calendarSummary: boolean;
    /** With the timesheet on: a finished shift's scheduled hours are added by themselves */
    autoHours: boolean;
}

export type FeatureKey = keyof Features;

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
    features: Features;
}

/** A browser never receives the refresh token: the backend keeps it in an httpOnly cookie. */
export interface AuthResponse {
    user: User;
    accessToken: string;
}