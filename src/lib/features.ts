import type { FeatureKey, Features, User } from '../interfaces/user.d';
import { updateProfile } from './auth';

// The parts of the app a person can switch on or off (Settings › Features, and the
// last welcome slide). The backend stores them on the account and fills in the
// defaults, so the phone and the web show the same app; this file only words them.

export interface FeatureInfo {
    key: FeatureKey;
    title: string;
    detail: string;
    /** Only shown — and only does anything — while this one is on */
    requires?: FeatureKey;
}

/** Extras: off or on depending on what someone needs from the app */
export const EXTRA_FEATURES: FeatureInfo[] = [
    { key: 'leaveBy', title: 'Leave-by times & routes', detail: 'When to leave for each shift — from home, or straight from the shift before — by transit, car or on foot.' },
    { key: 'weather', title: 'Weather', detail: 'The temperature for your next shift, and what to wear or bring.' },
    { key: 'timesheet', title: 'Clock in & timesheet', detail: 'Clock in and out, and see the hours you worked each pay period. Forgot to clock? We’ll ask after the shift.' },
    { key: 'autoHours', title: 'Add my hours for me', detail: 'When a shift ends without a clock-in, its scheduled hours are added for you. You can still change them.', requires: 'timesheet' },
    { key: 'pay', title: 'Pay estimates', detail: 'What your shifts and hours should pay, before and after deductions.' },
];

/** What the calendar shows around your shifts */
export const CALENDAR_FEATURES: FeatureInfo[] = [
    { key: 'sharedOnHome', title: 'Schedules shared with me', detail: 'Shifts from people who share their schedule with you, next to your own.' },
    { key: 'calendarSummary', title: 'Hours card', detail: 'Shifts and hours for the week or month, with the calendar.' },
];

/** The app itself — always there, listed so people know what they already have */
export const CORE_FEATURES = [
    { title: 'Every job, one calendar', detail: 'Type your shifts or scan a photo of the schedule.' },
    { title: 'Clashes', detail: 'Shifts that overlap, or that you can’t travel between in time.' },
    { title: 'Missed shifts', detail: 'Sick, or called off? Mark it and it stops counting.' },
];

// A user saved on the phone before features existed has none: show everything
// until the next refresh brings the real ones, rather than hide what they use.
const EVERYTHING_ON: Features = { leaveBy: true, weather: true, timesheet: true, pay: true, sharedOnHome: true, calendarSummary: true, autoHours: false };

export const featuresOf = (user: User | null | undefined): Features => user?.features ?? EVERYTHING_ON;

/** Switches one feature on the account; resolves to the updated user. */
export const setFeature = (key: FeatureKey, on: boolean) => updateProfile({ features: { [key]: on } });
