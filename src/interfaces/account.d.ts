/** One signed-in device or browser (`GET /account/sessions`). The name is made on the server. */
export interface SignedInDevice {
    id: string;
    device: { kind: 'browser' | 'app' | 'unknown'; name: string };
    /** The device asking */
    isCurrent: boolean;
    createdAt: string;
    lastUsedAt: string;
}

/** What deleting the account would remove (`GET /account/summary`). */
export interface AccountSummary {
    jobs: number;
    shifts: number;
    timeEntries: number;
    shares: number;
    /** Days to change your mind after asking to delete */
    graceDays: number;
}

/** A sign-in to an account waiting to be deleted answers with this instead of a session. */
export interface PendingDeletion {
    email: string;
    /** When it is erased for good */
    purgeAt: string;
    /** Short-lived; `restoreAccount` sends it back */
    restoreToken: string;
}
