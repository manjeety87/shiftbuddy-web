import type { CreateShiftInput, Shift } from '../interfaces/shift.d';
import { notify } from './notify';
import { createShift, createShiftsBulk, deleteShift } from './shifts';

const toInput = (shift: Shift): CreateShiftInput => ({ jobId: shift.jobId, startTime: shift.startTime, endTime: shift.endTime, notes: shift.notes ?? undefined });

/**
 * Puts deleted shifts back. The bulk route skips anything that overlaps an
 * existing shift (it's built for imports, where that means "duplicate"), but a
 * shift the user had chosen to keep overlapping must come back too — those are
 * re-created one by one with the overlap allowed.
 */
const restoreShifts = async (shifts: Shift[]) => {
    const { skipped } = await createShiftsBulk(shifts.map(toInput));
    for (const input of skipped) {
        await createShift({ ...input, allowOverlap: true });
    }
};

/**
 * Delete straight away and offer Undo, instead of asking "Are you sure?" first —
 * a mis-tap costs one tap to fix. Undo re-creates the same shifts (new ids).
 * `onChange` runs after the delete and after an undo, so lists can refresh.
 * Resolves false when nothing could be deleted, so a form can stay open.
 */
export const deleteShiftsWithUndo = async (shifts: Shift[], onChange?: () => void): Promise<boolean> => {
    if (shifts.length === 0) return false;

    const deleted: Shift[] = [];
    try {
        for (const shift of shifts) {
            await deleteShift(shift.id);
            deleted.push(shift);
        }
    } catch {
        notify.error(deleted.length ? `Only ${deleted.length} of ${shifts.length} shifts were deleted` : 'Couldn’t delete — please try again');
    }
    if (deleted.length === 0) return false;

    onChange?.();
    notify.success(deleted.length === 1 ? 'Shift deleted' : `${deleted.length} shifts deleted`, {
        action: {
            label: 'Undo',
            onPress: async () => {
                try {
                    await restoreShifts(deleted);
                    notify.success(deleted.length === 1 ? 'Shift restored' : 'Shifts restored');
                } catch {
                    notify.error(deleted.length === 1 ? 'Couldn’t restore — please add it again' : 'Couldn’t restore every shift — please check your schedule');
                } finally {
                    onChange?.();
                }
            },
        },
    });
    return true;
};
