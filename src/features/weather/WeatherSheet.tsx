"use client";

import { createElement } from "react";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import { formatTime } from "@/lib/dateUtils";
import { openSheet } from "@/lib/sheets";
import { getShiftById } from "@/lib/shifts";
import { useFetch } from "@/lib/useFetch";
import { formatDegrees, getShiftWeather, weatherIcon, type WeatherHour, type WeatherUnavailableReason } from "@/lib/weather";

const UNAVAILABLE: Record<WeatherUnavailableReason, string> = {
  NO_LOCATION: "This job has no location and there’s no home address, so there’s nowhere to check the weather for.",
  SHIFT_OVER: "This shift is over, so there’s no forecast for it.",
  TOO_FAR_AHEAD: "This shift is too far ahead for a forecast. Check back closer to the day.",
  PROVIDER_DOWN: "The forecast isn’t available right now. Please try again in a bit.",
};

/** The icon is chosen at render time, so it is created rather than declared (a moon for a clear night). */
export function WeatherGlyph({ hour, className }: { hour: Pick<WeatherHour, "condition" | "isDay">; className?: string }) {
  return createElement(weatherIcon(hour), { "aria-hidden": true, className });
}

/** The weather around a shift and what to wear or bring — both decided by the backend. */
export function WeatherSheet({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const { data: weather, error, retry } = useFetch(() => getShiftWeather(shiftId), [shiftId]);
  const { data: shift } = useFetch(() => getShiftById(shiftId), [shiftId]);

  return (
    <Sheet title="Weather" onClose={onClose}>
      {error ? (
        <LoadError message={error} onRetry={retry} />
      ) : !weather ? (
        <SkeletonRows rows={3} />
      ) : weather.status === "unavailable" ? (
        <div className="surface px-6 py-8 text-center">
          <p className="text-sm text-pretty text-muted-foreground">{UNAVAILABLE[weather.reason]}</p>
          {weather.reason === "NO_LOCATION" && shift && (
            <Button variant="secondary" size="sm" className="mt-4" onClick={() => openSheet({ kind: "job", jobId: shift.jobId })}>
              Set Job Location
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-4 surface p-5">
            <WeatherGlyph hour={weather.atStart} className="size-12 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-4xl font-semibold tabular-nums">{formatDegrees(weather.atStart.temperature)}</p>
              <p className="text-sm text-muted-foreground">
                {weather.atStart.conditionLabel} · feels like {formatDegrees(weather.atStart.feelsLike)}
              </p>
            </div>
            <dl className="text-right text-xs text-muted-foreground tabular-nums">
              <dt className="sr-only">Chance of rain</dt>
              <dd>{weather.atStart.rainChance}% rain</dd>
              <dt className="sr-only">Wind</dt>
              <dd>{Math.round(weather.atStart.windKmh)} km/h wind</dd>
            </dl>
          </div>
          <p className="-mt-3 mb-5 text-xs text-muted-foreground">
            When your shift starts ({formatTime(weather.atStart.time)}), {weather.place.source === "job" ? "at" : "near home —"} {weather.place.name}
            {weather.atEnd && ` · ${formatDegrees(weather.atEnd.temperature)} when it ends`}
          </p>

          {weather.advice.length > 0 && (
            <>
              <SectionLabel>What to wear or bring</SectionLabel>
              <ul className="mb-5 divide-y divide-border surface">
                {weather.advice.map((item) => (
                  <li key={item.title} className="px-4 py-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-sm text-pretty text-muted-foreground">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          <SectionLabel>Hour by hour</SectionLabel>
          <ul className="flex gap-1 overflow-x-auto surface p-3">
            {weather.hours.map((hour) => (
              <li key={hour.time} className="flex w-14 shrink-0 flex-col items-center gap-1.5 py-1 text-xs tabular-nums">
                <span className="text-muted-foreground">{new Date(hour.time).toLocaleTimeString("en-US", { hour: "numeric" })}</span>
                <WeatherGlyph hour={hour} className="size-5 text-foreground" />
                <span className="text-sm font-medium">{formatDegrees(hour.temperature)}</span>
                <span className={hour.rainChance >= 30 ? "text-info" : "text-muted-foreground"}>{hour.rainChance}%</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  );
}
