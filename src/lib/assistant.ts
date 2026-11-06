import type { MissedReason } from '../interfaces/shift.d';
import { api } from './api';
import { deviceTimeZone } from './dateUtils';
import { emitJobsChanged } from './jobs';
import { emitShiftsChanged } from './shiftEvents';
import { emitTimesheetChanged } from './timesheet';

// The assistant: the person says (or types) something, the backend asks Gemini what
// it means and answers with words, a card to confirm, and places to open. Nothing
// is saved until a yes — by voice ("haan, add kardo") or the card's button.

/** A job as a card draws it */
interface JobBadge {
    jobName: string;
    role: string | null;
    color: string;
}

interface Timed {
    startTime: string;
    endTime: string;
}

interface HoursWorked {
    clockIn: string;
    clockOut: string;
    breakMinutes: number;
    paidMinutes: number;
}

export type Proposal =
    | {
          type: 'addShifts';
          shifts: { jobId: string; startTime: string; endTime: string; notes?: string | null }[];
          allowOverlap: boolean;
          preview: { shifts: (JobBadge & Timed & { notes: string | null })[]; overlaps: (JobBadge & Timed)[] };
      }
    | {
          type: 'editShift';
          shiftId: string;
          jobId: string;
          startTime: string;
          endTime: string;
          allowOverlap: boolean;
          preview: { before: JobBadge & Timed; after: JobBadge & Timed; overlaps: (JobBadge & Timed)[] };
      }
    | { type: 'removeShifts'; shiftIds: string[]; preview: { shifts: (JobBadge & Timed & { missed: boolean })[] } }
    | { type: 'markMissed'; shiftId: string; reason: MissedReason; preview: JobBadge & Timed }
    | {
          type: 'logHours';
          /** One per shift; `entryId` when it replaces the hours that shift has */
          entries: { shiftId: string; entryId: string | null; clockIn: string; clockOut: string; breakMinutes?: number }[];
          preview: { entries: (JobBadge & Timed & HoursWorked & { before: (HoursWorked & { paidMinutes: number | null }) | null })[] };
      }
    | { type: 'addJob'; job: { companyName: string; title: string; hourlyRate?: number; color?: string }; preview: JobBadge }
    | { type: 'editJob'; jobId: string; changes: Record<string, unknown>; preview: { before: JobBadge; after: JobBadge } }
    | { type: 'deleteJob'; jobId: string; preview: JobBadge & { upcomingShifts: number } };

export interface Saved {
    /** restoreJob / undoHours: an Undo of deleteJob / logHours */
    type: Proposal['type'] | 'restoreJob' | 'undoHours';
    count: number;
    shiftIds: string[];
    /** Several shifts at once: the ones that clashed and were left out */
    skipped: number;
    jobId?: string;
    /** What puts it back (sent to /assistant/confirm); added shifts are deleted instead */
    undo?: Record<string, unknown>;
}

export type AssistantPage = 'home' | 'shifts' | 'calendar' | 'jobs' | 'timesheet' | 'sharing' | 'settings';
export type AssistantPanel = 'newShift' | 'newJob' | 'addHours' | 'paySummary' | 'scan' | 'statement' | 'themes';

export type AssistantAction =
    | { type: 'openPage'; page: AssistantPage }
    | { type: 'openShift'; shiftId: string }
    | { type: 'openPanel'; panel: AssistantPanel }
    | { type: 'closePanels' };

export interface AssistantTurn {
    reply: string;
    /** A Hinglish reply in Devanagari, for a Hindi voice to read (Roman Hindi sounds wrong in any voice) */
    speech: string | null;
    /** The card waiting after this turn (null: none) */
    pending: Proposal | null;
    actions: AssistantAction[];
    saved: Saved | null;
}

export interface HistoryLine {
    role: 'user' | 'assistant';
    text: string;
}

/** Earlier turns sent back each time (the backend's limit) */
export const MAX_HISTORY = 12;

/** Lists and the timesheet show what a confirmed card changed */
const announce = (saved: Saved | null) => {
    if (!saved) return;
    // A deleted or restored job takes its upcoming shifts with it
    emitShiftsChanged();
    if (saved.type === 'logHours' || saved.type === 'undoHours') emitTimesheetChanged();
    if (saved.type.endsWith('Job')) emitJobsChanged();
};

export const sendToAssistant = async (input: { message: string; history: HistoryLine[]; pending: Proposal | null; page?: AssistantPage }): Promise<AssistantTurn> => {
    // A few model calls can take a while on a busy free tier
    const { data } = await api.post<{ data: AssistantTurn }>('/assistant/messages', { ...input, history: input.history.slice(-MAX_HISTORY), timeZone: deviceTimeZone() }, { timeout: 45000 });
    announce(data.data.saved);
    return data.data;
};

/**
 * What a recording says, written down by ShiftBuddy (browsers without a speech
 * service, and Hinglish). Only the words: they are shown, then sent as a normal turn —
 * two short requests, so a slow transcription can never hide a card that saved.
 * Empty: nothing clear was said.
 */
export const transcribeRecording = async (audio: Blob): Promise<string> => {
    const form = new FormData();
    form.append('audio', audio, 'request.wav');
    const { data } = await api.post<{ data: { heard: string } }>('/assistant/transcribe', form, { timeout: 30000 });
    return data.data.heard;
};

/** After a reply that never arrived: whatever it may have saved shows up in every list */
export const refreshAfterLostReply = () => {
    emitShiftsChanged();
    emitJobsChanged();
    emitTimesheetChanged();
};

/** The card's Save button — or Undo, with the `undo` a change or removal came back with */
export const confirmProposal = async (proposal: Proposal | NonNullable<Saved['undo']>): Promise<Saved> => {
    const { data } = await api.post<{ data: Saved }>('/assistant/confirm', { proposal });
    announce(data.data);
    return data.data;
};
