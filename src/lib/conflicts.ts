import type { Shift } from '../interfaces/shift.d';
import { formatDateShort, formatTime } from './dateUtils';
import { api, type HttpError } from './api';
import { showAlert } from './dialog';
import type { TravelConflict } from './travelConflicts';
import { jobName } from './jobLabels';

export interface ShiftConflict {
    first: Shift;
    second: Shift;
}

const timeRange = (shift: Shift) => `${formatTime(shift.startTime)} – ${formatTime(shift.endTime)}`;

export const describeShift = (shift: Shift) =>
    `${jobName(shift.job)} · ${formatDateShort(shift.startTime)}, ${timeRange(shift)}`;

/** The clashing shifts from a backend 409 SHIFT_OVERLAP response, or null for any other error. */
export const getOverlapConflicts = (err: unknown): Shift[] | null => {
    const response = (err as HttpError)?.response;
    const details = response?.data?.details as { code?: string; conflicts?: Shift[] } | undefined;
    return response?.status === 409 && details?.code === 'SHIFT_OVERLAP' ? (details.conflicts ?? null) : null;
};

/** Asks whether to keep a shift that overlaps `conflicts`. Resolves true for "Save Anyway". */
export const confirmOverlap = (conflicts: Shift[]): Promise<boolean> =>
    new Promise((resolve) => {
        const list = conflicts.map((shift) => `• ${describeShift(shift)}`).join('\n');
        showAlert(
            conflicts.length === 1 ? 'Overlaps another shift' : `Overlaps ${conflicts.length} shifts`,
            `${list}\n\nYou can't be in two places at once — save it anyway?`,
            [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Save Anyway', onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
        );
    });

export interface ScheduleConflicts {
    overlaps: ShiftConflict[];
    travel: TravelConflict[];
}

/** Overlapping shifts (from now on) and travel-time conflicts (next 14 days), worked out by the backend. */
export const getConflicts = async (): Promise<ScheduleConflicts> => {
    const { data } = await api.get<{ data: ScheduleConflicts }>('/shifts/conflicts', {
        timeout: 30000, // travel checks may need several routing lookups
    });
    return data.data;
};
