import type { MissedReason } from '../interfaces/shift.d';
import { api } from './api';
import { deviceTimeZone } from './dateUtils';
import { emitShiftsChanged } from './shiftEvents';
import { emitTimesheetChanged } from './timesheet';

// The assistant: the person says (or types) something, the backend asks Gemini what
// it means and answers with words, a card to confirm, and places to open. Nothing
// is saved until a yes — by voice ("haan, add kardo") or the card's Save button.

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
          shiftId: string;
          clockIn: string;
          clockOut: string;
          breakMinutes?: number;
          preview: JobBadge & Timed & { clockIn: string; clockOut: string; breakMinutes: number; paidMinutes: number };
      };

export interface Saved {
    type: Proposal['type'];
    count: number;
    shiftIds: string[];
    /** Several shifts at once: the ones that clashed and were left out */
    skipped: number;
    entryId?: string;
    /** A change or removal: what puts it back (sent to /assistant/confirm) */
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
    emitShiftsChanged();
    if (saved.type === 'logHours') emitTimesheetChanged();
};

export const sendToAssistant = async (input: { message: string; history: HistoryLine[]; pending: Proposal | null; page?: AssistantPage }): Promise<AssistantTurn> => {
    // A few model calls can take a while on a busy free tier
    const { data } = await api.post<{ data: AssistantTurn }>('/assistant/messages', { ...input, history: input.history.slice(-MAX_HISTORY), timeZone: deviceTimeZone() }, { timeout: 45000 });
    announce(data.data.saved);
    return data.data;
};

/** The card's Save button — or Undo, with the `undo` a change or removal came back with */
export const confirmProposal = async (proposal: Proposal | NonNullable<Saved['undo']>): Promise<Saved> => {
    const { data } = await api.post<{ data: Saved }>('/assistant/confirm', { proposal });
    announce(data.data);
    return data.data;
};
