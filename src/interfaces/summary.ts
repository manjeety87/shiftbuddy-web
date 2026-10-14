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
}