import type { Shift } from '../interfaces/shift.d';
import type { CommuteMode } from '../interfaces/user.d';

export interface TravelConflict {
    /** late = you can't make it on time; tight = you'll arrive with under 5 minutes to spare */
    severity: 'late' | 'tight';
    mode: CommuteMode;
    fromShift: Shift;
    toShift: Shift;
    gapMinutes: number;
    travelMinutes: number;
    estimatedArrival: string;
    lateByMinutes: number;
    slackMinutes: number;
    /** Fix 1: leave the first job by this time to be on time (null = no trip makes it) */
    leaveBy: string | null;
    /** Fix 2: when you'd actually get to the next job if you leave as the first shift ends */
    earliestStart: string;
}

export const commuteLabel = (mode: CommuteMode) => (mode === 'DRIVING' ? 'driving' : 'transit');
