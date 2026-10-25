import type { Job, PayFrequency } from '../interfaces/job.d';
import { api } from './api';
import { createChangeSignal } from './changeSignal';
import { deviceTimeZone } from './dateUtils';

// Hours actually worked. The backend keeps the clock, works out pay periods,
// breaks and totals; this file calls it and tells screens when something changed.

export interface TimeEntry {
    id: string;
    jobId: string;
    shiftId: string | null;
    clockIn: string;
    clockOut: string | null; // null = still on the clock
    breakMinutes: number; // unpaid
    /** Added from the schedule by "Add my hours for me"; false once changed */
    isAutomatic?: boolean;
    job: Job;
}

/** An entry inside a timesheet: `paidMinutes` is null while it's still running. */
export type TimesheetEntry = Omit<TimeEntry, 'job'> & { paidMinutes: number | null };

export interface Timesheet {
    job: Pick<Job, 'id' | 'title' | 'companyName' | 'color' | 'hourlyRate'> & { payFrequency: PayFrequency; payday: string | null };
    /** Calendar days ("YYYY-MM-DD"); `end` is the last day covered */
    period: { start: string; end: string; payday: string | null; offset: number };
    entries: TimesheetEntry[];
    /** `estimatedPay`: gross less the user's deduction estimate (`taxDeductionPercent`) */
    totals: { entryCount: number; paidMinutes: number; breakMinutes: number; grossPay: number | null; estimatedPay?: number | null };
    taxDeductionPercent?: number;
}

const timesheetChanged = createChangeSignal();
/** Runs `onChange` after a clock-in, clock-out, edit or delete. */
export const useTimesheetChanged = timesheetChanged.useChanged;

export const getCurrentEntry = async (): Promise<TimeEntry | null> => (await api.get<{ data: TimeEntry | null }>('/timesheet/current')).data.data;

/** How long before a shift its clock opens — must match the backend's CLOCK_IN_EARLY_MINUTES (which is the one that enforces it). */
export const CLOCK_IN_OPENS_MINUTES_BEFORE = 10;

/** Start the clock for a scheduled shift. The backend refuses it more than 10 minutes early or after the shift has ended. */
export const clockIn = async (shiftId: string): Promise<TimeEntry> => {
    const { data } = await api.post<{ data: TimeEntry }>('/timesheet/clock-in', { shiftId });
    timesheetChanged.emit();
    return data.data;
};

/** Hours typed in afterwards — for a scheduled shift (`shiftId`) or for work that wasn't scheduled (`jobId`). Without `breakMinutes` the usual break is assumed. */
export const createTimeEntry = async (entry: ({ jobId: string } | { shiftId: string }) & { clockIn: string; clockOut: string; breakMinutes?: number }): Promise<TimeEntry> => {
    const { data } = await api.post<{ data: TimeEntry }>('/timesheet', entry);
    timesheetChanged.emit();
    return data.data;
};

/** A finished shift nobody clocked, with the hours it would have if it went to plan. */
export interface UnloggedShift {
    shift: { id: string; startTime: string; endTime: string; job: TimesheetJob };
    suggested: { clockIn: string; clockOut: string; breakMinutes: number; paidMinutes: number };
}

/** "Add your hours?" — empty while the timesheet is off or hours are added automatically (the backend decides). */
export const getUnloggedShifts = async (): Promise<UnloggedShift[]> => (await api.get<{ data: UnloggedShift[] }>('/timesheet/unlogged')).data.data;

type TimesheetJob = Timesheet['job'];

/** Every job together for a stretch of days (the shape `HoursSummary` builds on). */
export interface WeekTimesheet {
    period: { start: string; end: string; offset: number };
    entries: (TimesheetEntry & { job: Job })[];
    byJob: { job: TimesheetJob; entryCount: number; paidMinutes: number; breakMinutes: number; grossPay: number | null }[];
    /** `missingRates`: some hours belong to jobs without an hourly rate, so they aren't in `grossPay` */
    totals: Timesheet['totals'] & { missingRates: boolean };
}

/** How far back the hours summary looks: a Sun–Sat week, this week and last, a calendar month, or everything. */
export type SummaryRange = 'week' | 'twoWeeks' | 'month' | 'all';

/** Every job's hours and pay for a range (`GET /timesheet/summary`). `range: 'all'` sends no entries. */
export interface HoursSummary {
    range: SummaryRange;
    /** For `all`: `start` is the first day with hours (null when none) and `end` is null */
    period: { start: string | null; end: string | null; offset: number };
    entries: WeekTimesheet['entries'];
    byJob: (WeekTimesheet['byJob'][number] & { estimatedPay: number | null })[];
    totals: WeekTimesheet['totals'] & { estimatedPay: number | null };
    taxDeductionPercent: number;
}

/** `offset` 0 = the range today is in, -1 = the one before. */
export const getHoursSummary = async (range: SummaryRange, offset: number): Promise<HoursSummary> =>
    (await api.get<{ data: HoursSummary }>('/timesheet/summary', { params: { range, offset, timeZone: deviceTimeZone() } })).data.data;

/** What a statement covers: every job for a week, two weeks or a month — or one job's pay period. */
export type StatementOf = { range: Exclude<SummaryRange, 'all'>; offset: number } | { jobId: string; offset: number };

/** The hours worked (and the pay, while pay estimates are on) as a PDF to keep or send (`GET /timesheet/statement`). */
export const getStatementPdf = async (of: StatementOf): Promise<Blob> =>
    (await api.get<Blob>('/timesheet/statement', { params: { ...of, timeZone: deviceTimeZone() }, responseType: 'blob' })).data;

export const clockOut = async (): Promise<TimeEntry> => {
    const { data } = await api.post<{ data: TimeEntry }>('/timesheet/clock-out');
    timesheetChanged.emit();
    return data.data;
};

/** One job's entries and totals for a pay period; `offset` 0 = the period today is in, -1 = the one before. */
export const getTimesheet = async (jobId: string, offset: number): Promise<Timesheet> =>
    (await api.get<{ data: Timesheet }>('/timesheet', { params: { jobId, offset, timeZone: deviceTimeZone() } })).data.data;

export const getTimeEntry = async (entryId: string): Promise<TimeEntry> => (await api.get<{ data: TimeEntry }>(`/timesheet/${entryId}`)).data.data;

export const updateTimeEntry = async (entryId: string, changes: { clockIn?: string; clockOut?: string | null; breakMinutes?: number }): Promise<TimeEntry> => {
    const { data } = await api.patch<{ data: TimeEntry }>(`/timesheet/${entryId}`, changes);
    timesheetChanged.emit();
    return data.data;
};

export const deleteTimeEntry = async (entryId: string): Promise<void> => {
    await api.delete(`/timesheet/${entryId}`);
    timesheetChanged.emit();
};

/** 'YYYY-MM-DD' → "Oct 4" (local, no time-zone shift) */
export const formatCalendarDay = (day: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) => {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date).toLocaleDateString('en-US', options);
};

export const BREAK_CHOICES = [0, 15, 30, 45, 60] as const;
