import type { MissedReason } from './shift.d';

export interface JobSummary {
    jobId: string;
    jobTitle: string;
    companyName: string;
    color: string;
    hourlyRate: number | null;
    shiftCount: number;
    hours: number;
    grossPay: number;
}

export interface PaySummary {
    shiftCount: number;
    totalHours: number;
    /** Already worked (shifts are split at the current time) */
    completedHours: number;
    /** Still on the schedule in this period */
    upcomingHours: number;
    totalGrossPay: number;
    totalNetPay: number;
    taxDeductionPercent: number;
    byJob: JobSummary[];
    /** Shifts marked missed in the period — not in any number above */
    missed: { total: number; byReason: Partial<Record<MissedReason, number>> };
}