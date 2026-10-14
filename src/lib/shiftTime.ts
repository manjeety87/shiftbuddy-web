// How the shift form thinks about time: one day, a start time and an end time.
// An end time at or before the start time means the shift runs past midnight
// and ends the next day — so the user never has to pick an "end date".

const MINUTE_MS = 60 * 1000;

/**
 * Ontario's "three-hour rule" (ESA): someone who regularly works more than three
 * hours a day and is sent home early is generally owed at least three hours' pay.
 * Shorter shifts are allowed, so the form warns rather than blocks.
 */
export const MIN_SHIFT_MINUTES = 3 * 60;
const DEFAULT_START_HOUR = 9;
const DEFAULT_END_HOUR = 17;

export interface ShiftTimes {
    /** The day the shift starts on (time part ignored). */
    date: Date;
    /** Time of day the shift starts (date part ignored). */
    start: Date;
    /** Time of day the shift ends (date part ignored). */
    end: Date;
}

export interface ShiftRange {
    startAt: Date;
    endAt: Date;
    isOvernight: boolean;
    durationMinutes: number;
}

const atTime = (day: Date, hours: number, minutes = 0) => {
    const date = new Date(day);
    date.setHours(hours, minutes, 0, 0);
    return date;
};

/** 9 AM – 5 PM on `day` — a sensible starting point the user adjusts. */
export const defaultShiftTimes = (day = new Date()): ShiftTimes => ({
    date: atTime(day, 0),
    start: atTime(day, DEFAULT_START_HOUR),
    end: atTime(day, DEFAULT_END_HOUR),
});

/** A saved shift back into form fields. */
export const toShiftTimes = (startISO: string, endISO: string): ShiftTimes => {
    const start = new Date(startISO);
    return { date: atTime(start, 0), start, end: new Date(endISO) };
};

/** The real start/end instants the form describes. */
export const resolveShiftRange = ({ date, start, end }: ShiftTimes): ShiftRange => {
    const startAt = atTime(date, start.getHours(), start.getMinutes());
    const endAt = atTime(date, end.getHours(), end.getMinutes());
    const isOvernight = endAt <= startAt;
    if (isOvernight) endAt.setDate(endAt.getDate() + 1); // setDate keeps the wall-clock time across DST

    return {
        startAt,
        endAt,
        isOvernight,
        durationMinutes: Math.round((endAt.getTime() - startAt.getTime()) / MINUTE_MS),
    };
};

/** "8h", "7h 30m", "45m" */
export const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (hours === 0) return `${rest}m`;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};

/** Moving the start keeps the shift's length (the end moves with it), like a calendar app. */
export const withNewStart = (times: ShiftTimes, start: Date): ShiftTimes => {
    const { durationMinutes } = resolveShiftRange(times);
    return { ...times, start, end: new Date(start.getTime() + durationMinutes * MINUTE_MS) };
};

/** Same day and start, but `minutes` long. */
export const withDuration = (times: ShiftTimes, minutes: number): ShiftTimes => ({
    ...times,
    end: new Date(resolveShiftRange(times).startAt.getTime() + minutes * MINUTE_MS),
});
