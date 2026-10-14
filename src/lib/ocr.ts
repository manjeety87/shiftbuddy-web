import type { ExtractedShift } from "../interfaces/shift.d";
import { api } from "./api";
import { deviceTimeZone } from "./dateUtils";

/** Reads the shifts for `employeeName` out of a photo of a schedule. Nothing is saved yet. */
export const extractShiftsFromImage = async (image: File, employeeName: string): Promise<ExtractedShift[]> => {
  const formData = new FormData();
  formData.append("image", image);
  formData.append("employeeName", employeeName);
  // A schedule shows "9:00" with no zone — the backend reads it as this browser's local time
  formData.append("timeZone", deviceTimeZone());

  // Reading a schedule can take a while (the backend retries when the AI model is busy)
  const { data } = await api.post<{ data: { shifts: ExtractedShift[] } }>("/ocr/extract-shifts", formData, { timeout: 60000 });
  return data.data.shifts;
};
