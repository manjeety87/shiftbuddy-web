"use client";

import { RouteSheet } from "@/features/commute/RouteSheet";
import { ConflictSheet } from "@/features/conflicts/ConflictSheet";
import { JobSheet } from "@/features/jobs/JobSheet";
import { ScanSheet } from "@/features/scan/ScanSheet";
import { HomeAddressSheet, PasswordSheet, VerifyEmailSheet } from "@/features/settings/AccountSheets";
import { SharedSheet } from "@/features/sharing/SharedSheet";
import { CopySheet } from "@/features/shifts/CopySheet";
import { ShiftSheet } from "@/features/shifts/ShiftSheet";
import { TimeEntrySheet } from "@/features/timesheet/TimeEntrySheet";
import { WeatherSheet } from "@/features/weather/WeatherSheet";
import { closeSheet, useOpenSheets, type SheetRequest } from "@/lib/sheets";

const render = (request: SheetRequest, onClose: () => void) => {
  switch (request.kind) {
    case "shift":
      return <ShiftSheet shiftId={request.shiftId} date={request.date} onClose={onClose} />;
    case "job":
      return <JobSheet jobId={request.jobId} onClose={onClose} />;
    case "timeEntry":
      return <TimeEntrySheet entryId={request.entryId} shiftId={request.shiftId} jobId={request.jobId} onClose={onClose} />;
    case "copy":
      return <CopySheet shiftIds={request.shiftIds} onClose={onClose} />;
    case "route":
      return <RouteSheet shiftId={request.shiftId} onClose={onClose} />;
    case "weather":
      return <WeatherSheet shiftId={request.shiftId} onClose={onClose} />;
    case "conflict":
      return <ConflictSheet conflict={request.conflict} fromId={request.fromId} toId={request.toId} onClose={onClose} />;
    case "scan":
      return <ScanSheet onClose={onClose} />;
    case "shared":
      return <SharedSheet ownerId={request.ownerId} ownerName={request.ownerName} date={request.date} onClose={onClose} />;
    case "verifyEmail":
      return <VerifyEmailSheet onClose={onClose} />;
    case "password":
      return <PasswordSheet onClose={onClose} />;
    case "home":
      return <HomeAddressSheet onClose={onClose} />;
  }
};

/** Draws every open sheet, oldest first, so a sheet opened from another sits on top of it. */
export function SheetHost() {
  const sheets = useOpenSheets();
  return sheets.map(({ id, request }) => <div key={id}>{render(request, () => closeSheet(id))}</div>);
}
