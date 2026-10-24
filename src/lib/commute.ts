import type { CommuteMode } from '../interfaces/user.d';
import { api } from './api';
import type { TransitItinerary } from './transit';

// Getting to a shift. The backend works out every time here (buffer, leave-by,
// routes) so the app and the web app show the same answers; this file only
// fetches them.

/** The backend takes any whole number of minutes up to this (ARRIVAL_BUFFER_MAX_MINUTES there). */
export const ARRIVAL_BUFFER_MAX_MINUTES = 120;

/** How early people can choose to arrive: quick picks, or Custom for any other minute. */
export const ARRIVAL_BUFFER_OPTIONS = [
    { value: '0', label: 'On time' },
    { value: '5', label: '5 min' },
    { value: '10', label: '10 min' },
    { value: '15', label: '15 min' },
    { value: 'custom', label: 'Custom' },
] as const;

export type ArrivalBufferChoice = (typeof ARRIVAL_BUFFER_OPTIONS)[number]['value'];

/** The option a saved buffer shows as: its quick pick, or Custom (e.g. 7 min) */
export const arrivalBufferChoice = (minutes: number): ArrivalBufferChoice =>
    ARRIVAL_BUFFER_OPTIONS.find((option) => option.value === String(minutes))?.value ?? 'custom';

/** "For a 10:00 AM shift you’ll be there by 9:53 AM." — makes a minute count concrete */
export const describeArriveByExample = (minutes: number) => {
    const arriveAt = 10 * 60 - minutes; // the buffer is at most 2 h, so this stays in the morning
    const time = `${Math.floor(arriveAt / 60)}:${String(arriveAt % 60).padStart(2, '0')} AM`;
    return `For a 10:00 AM shift you’ll be there by ${time}.`;
};

/** "arrive 10 min early" / "arrive right on time" */
export const describeArrivalBuffer = (minutes: number) => (minutes === 0 ? 'arrive right on time' : `arrive ${minutes} min early`);

type Coords = { lat: number; lng: number };

/**
 * Where a trip to a shift starts. `auto` (what the backend picks): the job of the
 * shift just before, when there is one, otherwise home. The others ask for one.
 */
export type StartChoice = 'auto' | 'home' | 'previousShift';

/** The starting point the backend used: home, or the shift you come straight from */
export interface TripStart {
    kind: 'previousShift' | 'home' | 'here';
    /** "Boathouse", "Home", "Your location" */
    name: string;
    /** previousShift: when that shift ends */
    endsAt?: string;
    shiftId?: string;
}

export interface LeavePlan {
    /** WALK within about 1 km, whatever the usual commute */
    mode: CommuteMode | 'WALK';
    leaveAt: string;
    arriveBy: string;
    arrivalBufferMinutes: number;
    travelMinutes: number;
    /** Transit lines ridden, e.g. ["35", "5"]; empty when driving or walking */
    lines: string[];
    from: TripStart;
    /** Other starting points that can be asked for */
    alternatives: Exclude<StartChoice, 'auto'>[];
    /** Same building as the shift before: nothing to plan, be there by arriveBy */
    sameBuilding?: boolean;
    /** The gap is shorter than the trip: leave as the shift before ends */
    leavesAsShiftEnds?: boolean;
    /** How late the start will be reached (0 = on time) */
    lateMinutes: number;
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
    from: TripStart;
    /** The shift you come straight from, for the From choices; null when there isn't one */
    previousShift: { name: string; endsAt: string; shiftId: string } | null;
    hasHome: boolean;
    /** Within about 1 km: the walk (transit has nothing to say about a short hop) */
    walking: { durationMinutes: number; leaveBy: string } | null;
    origin: Coords;
    destination: Coords;
    arriveBy: string;
    arrivalBufferMinutes: number;
    driving: DrivingPlan | null;
    transit: TransitPlan;
}

/** When to leave for a shift, and from where. null once it has started, or when it can't be worked out. */
export const getLeavePlan = async (shiftId: string, from: StartChoice = 'auto'): Promise<LeavePlan | null> => {
    const { data } = await api.get<{ data: LeavePlan | null }>(`/shifts/${shiftId}/leave-plan`, { params: { from } });
    return data.data;
};

/** Driving + transit to a shift (and back home): from `here` (a location) when given, otherwise by `from`. */
export const getShiftRoutes = async (shiftId: string, { here, from = 'auto' }: { here?: Coords; from?: StartChoice } = {}): Promise<ShiftRoutes> => {
    const params = here ? { fromLat: here.lat, fromLng: here.lng } : { from };
    const { data } = await api.get<{ data: ShiftRoutes }>(`/shifts/${shiftId}/routes`, { params });
    return data.data;
};

/** "69 min by transit · 103 › MI › 31" / "17 min drive" / "4 min walk" */
export const summarizeLeavePlan = (plan: LeavePlan) =>
    plan.mode === 'WALK'
        ? `${plan.travelMinutes} min walk`
        : plan.mode === 'DRIVING'
          ? `${plan.travelMinutes} min drive`
          : `${plan.travelMinutes} min by transit${plan.lines.length ? ` · ${plan.lines.slice(0, 3).join(' › ')}` : ''}`;
