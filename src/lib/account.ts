import type { AccountSummary, PendingDeletion, SignedInDevice } from '../interfaces/account.d';
import type { AuthResponse } from '../interfaces/user.d';
import { api, type HttpError } from './api';
import { saveTokens } from './storage';

// The account as a whole: where it is signed in, a copy of everything in it, and
// deleting it (30 days to change your mind). The rules live on the server.

export const getSignedInDevices = async (): Promise<SignedInDevice[]> => {
    const { data } = await api.get<{ data: SignedInDevice[] }>('/account/sessions');
    return data.data;
};

/** Signs one other device out. This device uses Log out instead. */
export const signOutDevice = async (sessionId: string): Promise<void> => {
    await api.delete(`/account/sessions/${sessionId}`);
};

/** Signs every device out except this one; answers how many there were. */
export const signOutOtherDevices = async (): Promise<number> => {
    const { data } = await api.delete<{ data: { signedOut: number } }>('/account/sessions');
    return data.data.signedOut;
};

export const getAccountSummary = async (): Promise<AccountSummary> => {
    const { data } = await api.get<{ data: AccountSummary }>('/account/summary');
    return data.data;
};

/** Everything in the account as one JSON document (profile, jobs, shifts, hours, sharing). */
export const exportMyData = async (): Promise<unknown> => {
    const { data } = await api.get<{ data: unknown }>('/account/export');
    return data.data;
};

/**
 * Asks for the account to be deleted: a password account sends its password, a
 * Google/Apple one the word DELETE. It is signed out everywhere at once and erased
 * on `purgeAt` unless someone signs in and restores it first.
 */
export const requestAccountDeletion = async (confirmation: { password: string } | { confirm: string }): Promise<{ purgeAt: string }> => {
    const { data } = await api.post<{ data: { purgeAt: string } }>('/account/deletion', confirmation);
    return data.data;
};

/** A sign-in that met an account waiting to be deleted: when it goes, and the token to bring it back. Otherwise null. */
export const pendingDeletionOf = (error: unknown): PendingDeletion | null => {
    const details = (error as HttpError)?.response?.data?.details as (Partial<PendingDeletion> & { code?: string }) | null | undefined;
    if (details?.code !== 'ACCOUNT_PENDING_DELETION' || !details.restoreToken || !details.purgeAt) return null;
    return { email: details.email ?? '', purgeAt: details.purgeAt, restoreToken: details.restoreToken };
};

/** Cancels the deletion and signs in. */
export const restoreAccount = async (restoreToken: string) => {
    const { data } = await api.post<{ data: AuthResponse }>('/auth/restore', { restoreToken });
    await saveTokens(data.data.accessToken);
    return data.data.user;
};
