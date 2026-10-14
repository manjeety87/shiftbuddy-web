export const formatTime = (isoString: string): string => {
    return new Date(isoString).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

export const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
};

export const formatDateShort = (isoString: string): string => {
    return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

// YYYY-MM-DD in the device's local time — react-native-calendars isi format me
// dates chahta hai. (Slicing the ISO string gives the UTC day, which puts an
// 8pm Toronto shift on the next day.)
export const toCalendarDateString = (isoString: string): string => {
    const date = new Date(isoString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
};

export const isToday = (isoString: string): boolean => {
    const date = new Date(isoString);
    const today = new Date();
    return date.toDateString() === today.toDateString();
};

// Diye gaye date ke hafte ke saare 7 din (Sunday se Saturday) return karta hai
export const getWeekDays = (centerDate: Date): Date[] => {
    const start = new Date(centerDate);
    start.setDate(centerDate.getDate() - centerDate.getDay()); // Sunday pe le jaao
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
    });
};

export const isSameDay = (a: Date, b: Date): boolean => a.toDateString() === b.toDateString();

// "18h 20m" jaisa countdown string banata hai
export const formatCountdown = (targetISO: string): string => {
    const diffMs = new Date(targetISO).getTime() - Date.now();

    if (diffMs <= 0) return 'In progress';

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

/** "YYYY-MM-DD" → the colours of the jobs working that day, for calendar dots. */
export const groupJobColorsByDate = (shifts: { startTime: string; job: { color: string } }[]) => {
    const byDate: Record<string, string[]> = {};
    shifts.forEach((shift) => {
        const dayColors = (byDate[toCalendarDateString(shift.startTime)] ??= []);
        if (!dayColors.includes(shift.job.color)) dayColors.push(shift.job.color);
    });
    return byDate;
};

/** The device's IANA time zone ("America/Toronto") — sent to the backend for day/DST-aware work. */
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
