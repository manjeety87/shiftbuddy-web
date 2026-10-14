import { api } from './api';
import { deviceTimeZone } from './dateUtils';

// The plain-text schedule for WhatsApp/SMS ("Mon, Oct 5: 9 AM – 5 PM Boathouse …")
// is written by the backend, in this device's time zone, so the app and the web
// app send exactly the same message.

export type ScheduleRange = 'thisWeek' | 'nextWeek' | 'thisMonth';
export type ScheduleNameStyle = 'workplace' | 'job';

export interface ScheduleMessageOptions {
    range: ScheduleRange;
    nameStyle: ScheduleNameStyle;
    includeDaysOff: boolean;
}

export interface ScheduleMessage {
    message: string;
    shiftCount: number;
    totalMinutes: number;
    /** First day covered, "YYYY-MM-DD" */
    startDate: string;
    days: number;
}

export const getScheduleMessage = async ({ range, nameStyle, includeDaysOff }: ScheduleMessageOptions): Promise<ScheduleMessage> => {
    const { data } = await api.get<{ data: ScheduleMessage }>('/shifts/schedule-message', {
        params: { range, nameStyle, includeDaysOff, timeZone: deviceTimeZone() },
    });
    return data.data;
};
