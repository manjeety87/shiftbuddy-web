// The shape of a transit trip. Trips reach the app inside a shift's routes (lib/commute).

export type TransitMode = 'WALK' | 'BUS' | 'SUBWAY' | 'TRAM' | 'RAIL' | 'REGIONAL_RAIL' | 'METRO' | 'FERRY' | (string & {});

export interface TransitStop {
    name: string | null; // null = the trip's start/end point (home, job)
    latitude: number;
    longitude: number;
    time: string | null;
}

export interface TransitLeg {
    mode: TransitMode;
    line: string | null; // "97", "Line 2", "LE"
    lineName: string | null; // "Yonge", "Lakeshore East"
    color: string | null; // the agency's own line colour
    textColor: string | null;
    agency: string | null;
    headsign: string | null;
    from: TransitStop;
    to: TransitStop;
    departure: string;
    arrival: string;
    durationMinutes: number;
    distanceMeters: number | null; // walking legs
    stopCount: number | null; // transit legs
    realTime: boolean;
    geometry: [number, number][]; // [lat, lng]
}

export interface TransitItinerary {
    departure: string;
    arrival: string;
    durationMinutes: number;
    transfers: number;
    walkMinutes: number;
    legs: TransitLeg[];
}

export const isWalk = (leg: TransitLeg) => leg.mode === 'WALK';

export const modeLabel = (mode: TransitMode) => {
    switch (mode) {
        case 'BUS': return 'Bus';
        case 'SUBWAY':
        case 'METRO': return 'Subway';
        case 'TRAM': return 'Streetcar';
        case 'RAIL':
        case 'REGIONAL_RAIL': return 'Train';
        case 'FERRY': return 'Ferry';
        case 'WALK': return 'Walk';
        default: return 'Transit';
    }
};

export const formatDistance = (meters: number) =>
    meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;
