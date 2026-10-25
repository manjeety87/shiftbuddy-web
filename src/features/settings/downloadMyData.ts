import { exportMyData } from "@/lib/account";
import { toCalendarDateString } from "@/lib/dateUtils";
import { saveFile } from "@/lib/saveFile";

/** Fetches a copy of the account and saves it as a dated JSON file. */
export const downloadMyData = async () => {
  const data = await exportMyData();
  saveFile(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `shiftbuddy-data-${toCalendarDateString(new Date().toISOString())}.json`);
};
