import { api } from './api';

export type ShareDuration = 'week' | 'month' | 'forever';

/** Someone I let see my shifts */
export interface OutgoingShare {
    id: string;
    email: string;
    name: string | null;
    /** pending = that email has no (verified) ShiftBuddy account yet */
    status: 'active' | 'pending';
    expiresAt: string | null; // null = until I stop sharing
    createdAt: string;
}

/** Someone who lets me see their shifts */
export interface IncomingShare {
    id: string;
    owner: { id: string; name: string };
    expiresAt: string | null;
}

/** What a viewer gets of another person's shift — no pay, notes or locations */
export interface SharedShift {
    id: string;
    startTime: string;
    endTime: string;
    job: { title: string; companyName: string; color: string };
}

export const SHARE_DURATIONS: { value: ShareDuration; label: string }[] = [
    { value: 'week', label: '1 week' },
    { value: 'month', label: '1 month' },
    { value: 'forever', label: 'Until I stop' },
];

export const getOutgoingShares = async (): Promise<OutgoingShare[]> => (await api.get<{ data: OutgoingShare[] }>('/shares')).data.data;

export const shareShifts = async (email: string, duration: ShareDuration): Promise<OutgoingShare> =>
    (await api.post<{ data: OutgoingShare }>('/shares', { email: email.trim(), duration })).data.data;

/** Stop sharing (as the owner) or remove a schedule someone shared with me. */
export const stopSharing = async (shareId: string): Promise<void> => {
    await api.delete(`/shares/${shareId}`);
};

export const getIncomingShares = async (): Promise<IncomingShare[]> => (await api.get<{ data: IncomingShare[] }>('/shares/received')).data.data;

export const getSharedShifts = async (ownerId: string, from: string, to: string) =>
    (await api.get<{ data: { owner: { id: string; name: string }; shifts: SharedShift[] } }>(`/shares/${ownerId}/shifts`, { params: { from, to } })).data.data;

/** "Until Oct 12" / "Until you stop sharing" */
export const formatShareExpiry = (expiresAt: string | null, untilStoppedLabel = 'Until you stop sharing') =>
    expiresAt ? `Until ${new Date(expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : untilStoppedLabel;
