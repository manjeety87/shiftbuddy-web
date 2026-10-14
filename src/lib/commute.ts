import type { CommuteMode } from '../interfaces/user.d';
import { api } from './api';
import type { TransitItinerary } from './transit';

// Getting to a shift. The backend works out every time here (buffer, leave-by,
// routes) so the app and the web app show the same answers; this file only
// fetches them.

/** How early people can choose to arrive — must match the backend's ARRIVAL_BUFFER_OPTIONS. */
export const ARRIVAL_BUFFER_OPTIONS = [
    { value: '0', label: 'On time' },
    { value: '5', label: '5 min' },
    { value: '10', label: '10 min' },
    { value: '15', label: '15 min' },
] as const;

/** "arrive 10 min early" / "arrive right on time" */
export const describeArrivalBuffer = (minutes: number) => (minutes === 0 ? 'arrive right on time' : `arrive ${minutes} min early`);

type Coords = { lat: number; lng: number };

export interface LeavePlan {
    mode: CommuteMode;
    leaveAt: string;
    arriveBy: string;
    arrivalBufferMinutes: number;
    travelMinutes: number;
    /** Transit lines ridden, e.g. ["35", "5"]; empty when driving */
    lines: string[];
}

export interface DrivingPlan {
    durationMinutes: number;
    distanceKm: number;
    geometry: [number, number][]; // [lat, lng]
    leaveBy: string;
    /** null when planning from the current location instead of home */
    backHomeAround: string | null;
}

export type TransitPlan =
    | { status: 'ok'; toWork: TransitItinerary[]; toHome: TransitItinerary[] }
    | { status: 'unavailable'; message: string };

export interface ShiftRoutes {
    fromHome: boolean;
    origin: Coords;
    destination: Coords;
    arriveBy: string;
    arrivalBufferMinutes: number;
    driving: DrivingPlan | null;
    transit: TransitPlan;
}

/** When to leave home for a shift, by the user's usual commute. null when it can't be worked out. */
export const getLeavePlan = async (shiftId: string): Promise<LeavePlan | null> => {
    const { data } = await api.get<{ data: LeavePlan | null }>(`/shifts/${shiftId}/leave-plan`);
    return data.data;
};

/** Driving + transit to a shift (and back home), from home or from `from`. */
export const getShiftRoutes = async (shiftId: string, from?: Coords): Promise<ShiftRoutes> => {
    const params = from ? { fromLat: from.lat, fromLng: from.lng } : undefined;
    const { data } = await api.get<{ data: ShiftRoutes }>(`/shifts/${shiftId}/routes`, { params });
    return data.data;
};

/** "69 min by transit · 103 › MI › 31" / "17 min drive" */
export const summarizeLeavePlan = (plan: LeavePlan) =>
    plan.mode === 'DRIVING'
        ? `${plan.travelMinutes} min drive`
        : `${plan.travelMinutes} min by transit${plan.lines.length ? ` · ${plan.lines.slice(0, 3).join(' › ')}` : ''}`;
