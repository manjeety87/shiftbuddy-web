import type { Job } from './job';

export interface Shift {
    id: string;
    startTime: string; // ISO string — backend hamesha isi format me bhejta hai
    endTime: string;
    notes: string | null;
    jobId: string;
    /** Hours clocked for this shift — only on lists from GET /shifts; usually none or one */
    timeEntries?: { id: string; clockIn: string; clockOut: string | null; breakMinutes: number }[];
    job: Job; // backend `include: { job: true }` karta hai, isliye ye hamesha saath aata hai
    userId: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateShiftInput {
    jobId: string;
    startTime: string; // ISO string bhejna hoga
    endTime: string;
    notes?: string;
    allowOverlap?: boolean; // save even if it clashes with another shift
}

export type UpdateShiftInput = Partial<CreateShiftInput>;

// OCR se extract hui shift — abhi save nahi hui, user confirm karega
export interface ExtractedShift {
    startTime: string;
    endTime: string;
    notes?: string;
    needsReview: boolean;
    /** The job whose workplace, role or match keywords appear next to the shift — null when none or several fit */
    suggestedJobId: string | null;
}