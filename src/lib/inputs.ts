// Browser date/time inputs speak "YYYY-MM-DD" and "HH:MM" in local time.
// (Slicing an ISO string would give the UTC day — an 8pm Toronto shift on the next day.)

const pad = (value: number) => String(value).padStart(2, "0");

export const toDateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const toTimeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** "YYYY-MM-DD" → local midnight that day; null while the field is half-typed. */
export const fromDateInput = (value: string): Date | null => {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
};

/** "HH:MM" → that time of day (the date part is not used); null while half-typed. */
export const fromTimeInput = (value: string): Date | null => {
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days); // setDate keeps the wall-clock time across DST
  return next;
};

export const startOfDay = (date: Date) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

export const formatMoney = (amount: number) => amount.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

/** "Today" / "Tomorrow" / "Yesterday" / "Mon, Oct 12" */
export const formatDayLabel = (date: Date, now = new Date()) => {
  const days = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};
