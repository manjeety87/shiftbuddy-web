import type { MissedReason, Shift } from '../interfaces/shift.d';
import { api } from './api';
import { emitShiftsChanged } from './shiftEvents';

// Shifts the user couldn't go to, or that were called off. The backend decides what a
// missed shift stops counting for (pay, leave-by, conflicts, clock-in); this file names
// the reasons and calls the two routes.

/** In the order the sheet lists them: the common ones first */
export const MISSED_REASONS: { value: MissedReason; label: string; short: string }[] = [
    { value: 'SICK', label: 'I was sick', short: 'Sick' },
    { value: 'CALLED_OFF', label: 'My manager called it off', short: 'Called off' },
    { value: 'EMERGENCY', label: 'An emergency came up', short: 'Emergency' },
    { value: 'TRANSIT', label: 'Couldn’t get there — transit or weather', short: 'Transit or weather' },
    { value: 'OTHER', label: 'Something else', short: 'Other' },
];

const shortLabel = (reason: MissedReason) => MISSED_REASONS.find((option) => option.value === reason)?.short ?? 'Other';

/** "Called off", or "Missed · Sick" — a called-off shift wasn't the user's to miss */
export const missedTag = (reason: MissedReason) => (reason === 'CALLED_OFF' ? 'Called off' : `Missed · ${shortLabel(reason)}`);

/** "3 this year — 2 sick, 1 called off" from the summary's `missed` counts */
export const describeMissedCounts = ({ total, byReason }: { total: number; byReason: Partial<Record<MissedReason, number>> }, period: string) => {
    const parts = MISSED_REASONS.filter((option) => byReason[option.value]).map((option) => `${byReason[option.value]} ${option.short.toLowerCase()}`);
    return `${total} ${period}${parts.length ? ` — ${parts.join(', ')}` : ''}`;
};

/** Marks (or re-marks, with a new reason or note) a shift as missed. An empty note clears it. */
export const markShiftMissed = async (shiftId: string, input: { reason: MissedReason; note: string }): Promise<Shift> => {
    const { data } = await api.put<{ data: Shift }>(`/shifts/${shiftId}/missed`, input);
    emitShiftsChanged();
    return data.data;
};

/** Undo: the shift counts again */
export const clearShiftMissed = async (shiftId: string): Promise<Shift> => {
    const { data } = await api.delete<{ data: Shift }>(`/shifts/${shiftId}/missed`);
    emitShiftsChanged();
    return data.data;
};
