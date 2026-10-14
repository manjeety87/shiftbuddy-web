import { createChangeSignal } from './changeSignal';

// Fired by every shift mutation in lib/shifts
const shiftsChanged = createChangeSignal();

export const emitShiftsChanged = shiftsChanged.emit;

/** Runs `onChange` whenever shifts are created, edited or deleted. */
export const useShiftsChanged = shiftsChanged.useChanged;
