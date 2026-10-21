import { exportMyData } from "@/lib/account";
import { toCalendarDateString } from "@/lib/dateUtils";

/** Fetches a copy of the account and saves it as a dated JSON file. */
export const downloadMyData = async () => {
  const data = await exportMyData();
  const file = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `shiftbuddy-data-${toCalendarDateString(new Date().toISOString())}.json`;
  link.click();
  // After the click has handed the file to the browser
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
