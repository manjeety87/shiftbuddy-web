"use client";

import { Briefcase, Bus, ChevronDown, ChevronRight, ExternalLink, Footprints, House, LocateFixed, Ship, TrainFront, TramFront } from "lucide-react";
import { useState } from "react";
import { MapView, type MapLine } from "@/components/MapView";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Sheet } from "@/components/ui/Sheet";
import { LoadError, SkeletonRows } from "@/components/ui/States";
import { HttpError } from "@/lib/api";
import { readableTextOn } from "@/lib/color";
import { getShiftRoutes, type StartChoice } from "@/lib/commute";
import { formatTime } from "@/lib/dateUtils";
import { splitAddress } from "@/lib/geocode";
import { jobName } from "@/lib/jobLabels";
import { directionsUrl } from "@/lib/mapLinks";
import { useUser } from "@/lib/session";
import { openSheet } from "@/lib/sheets";
import { getShiftById } from "@/lib/shifts";
import { formatDistance, isWalk, modeLabel, type TransitItinerary, type TransitLeg, type TransitMode } from "@/lib/transit";
import { useFetch } from "@/lib/useFetch";

type Mode = "TRANSIT" | "DRIVING";
type Coords = { lat: number; lng: number };

const MODES = [
  { value: "TRANSIT", label: "Transit" },
  { value: "DRIVING", label: "Driving" },
] as const;

const WALK_COLOUR = "#8a8a8a";
const label = "text-2xs font-semibold tracking-wide text-muted-foreground uppercase";

function ModeIcon({ mode, className = "size-3" }: { mode: TransitMode; className?: string }) {
  const Icon = mode === "WALK" ? Footprints : ["SUBWAY", "METRO", "RAIL", "REGIONAL_RAIL"].includes(mode) ? TrainFront : mode === "TRAM" ? TramFront : mode === "FERRY" ? Ship : Bus;
  return <Icon aria-hidden className={className} />;
}

/** The coloured "97" / "Line 2" pill, in the agency's own colours. */
function LineBadge({ leg }: { leg: TransitLeg }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-bold"
      style={{ backgroundColor: leg.color ?? "var(--muted)", color: leg.textColor ?? (leg.color ? readableTextOn(leg.color) : "var(--foreground)") }}
    >
      <ModeIcon mode={leg.mode} />
      {leg.line ?? modeLabel(leg.mode)}
    </span>
  );
}

/** The trip at a glance: walk 15 › 103 › 31 › walk 4. Short walks between stops are noise, so only the first, the last and the long ones stay. */
function LegSummary({ legs }: { legs: TransitLeg[] }) {
  const shown = legs.filter((leg, index) => !isWalk(leg) || index === 0 || index === legs.length - 1 || leg.durationMinutes >= 5);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((leg, index) => (
        <span key={index} className="flex items-center gap-1">
          {index > 0 && <ChevronRight aria-hidden className="size-3 text-faint" />}
          {isWalk(leg) ? (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
              <Footprints aria-label="Walk" className="size-3.5" />
              {leg.durationMinutes}
            </span>
          ) : (
            <LineBadge leg={leg} />
          )}
        </span>
      ))}
    </span>
  );
}

/** A dot and the line down to the next step: solid in the line's colour for a ride, dotted for a walk. */
function Rail({ colour, walk = false, last = false }: { colour: string; walk?: boolean; last?: boolean }) {
  return (
    <span aria-hidden className="flex w-3.5 shrink-0 flex-col items-center">
      <span className="mt-1 size-2.5 shrink-0 rounded-full border-2" style={{ borderColor: colour, backgroundColor: last ? colour : "var(--card)" }} />
      {!last && <span className="my-0.5 flex-1 rounded-full" style={walk ? { borderLeft: `2px dotted ${colour}` } : { width: 4, backgroundColor: colour }} />}
    </span>
  );
}

/**
 * A stop or direction that fits on one line, like the rest of the steps. Someone
 * new to the area can tap it to read the whole name (to match it against the sign
 * at the stop) and tap again to fold it back. With a pointer, hovering shows it too.
 */
function FullName({ text, className }: { text: string; className: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" title={text} onClick={() => setOpen((value) => !value)} className={`block w-full min-w-0 text-left ${open ? "text-pretty wrap-break-word" : "truncate"} ${className}`}>
      {text}
    </button>
  );
}

// A phone gets a narrower, centred time column so the names keep more room
const stepTime = "w-14 shrink-0 pt-px text-center text-xs text-muted-foreground tabular-nums md:w-16 md:text-right";

/** One trip step by step: times on the left, a rail down the middle, each ride in its own card. */
function Steps({ trip, start, destination }: { trip: TransitItinerary; start: string; destination: string }) {
  return (
    <ol className="border-t border-border px-3 pt-4 pb-4 md:px-4">
      {trip.legs.map((leg, index) => {
        const walk = isWalk(leg);
        const where = leg.to.name ?? destination;
        return (
          <li key={index} className="flex gap-2.5">
            <span className={stepTime}>{formatTime(leg.departure)}</span>
            <Rail colour={walk ? WALK_COLOUR : (leg.color ?? "var(--primary)")} walk={walk} />
            <div className="min-w-0 flex-1 pb-4">
              <FullName text={leg.from.name ?? (index === 0 ? start : "Start")} className="text-sm font-semibold" />
              {walk ? (
                <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                  <Footprints aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Walk {leg.durationMinutes} min{leg.distanceMeters ? ` (${formatDistance(leg.distanceMeters)})` : ""} to {where}
                  </span>
                </p>
              ) : (
                <div className="mt-1.5 rounded-lg bg-background px-3 py-2.5 shadow-[0_0_0_1px_var(--line)]">
                  <p className="flex items-start gap-2">
                    <LineBadge leg={leg} />
                    <span className="min-w-0 flex-1 pt-px">
                      <FullName text={leg.headsign ?? leg.lineName ?? modeLabel(leg.mode)} className="text-sm font-medium" />
                    </span>
                  </p>
                  <p className="mt-1.5 text-xs text-pretty">
                    Get off at {where} · {formatTime(leg.arrival)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {leg.stopCount} stop{leg.stopCount === 1 ? "" : "s"} · {leg.durationMinutes} min{leg.realTime ? " · live" : ""}
                  </p>
                </div>
              )}
            </div>
          </li>
        );
      })}
      <li className="flex gap-2.5">
        <span className={stepTime}>{formatTime(trip.arrival)}</span>
        <Rail colour="var(--primary)" last />
        <span className="min-w-0 flex-1">
          <FullName text={destination} className="text-sm font-semibold" />
        </span>
      </li>
    </ol>
  );
}

/**
 * One way to get there. Closed, it is the answer (when, how long, which lines);
 * pressing it puts the trip on the map and opens its steps, pressing again closes them.
 */
function TripCard({ trip, isOnMap, isOpen, onPress, leaveLabel, start, destination }: { trip: TransitItinerary; isOnMap: boolean; isOpen: boolean; onPress: () => void; leaveLabel: string; start: string; destination: string }) {
  const firstRide = trip.legs.find((leg) => !isWalk(leg));
  const details = [`${leaveLabel} ${formatTime(trip.departure)}`, trip.transfers === 0 ? "No transfers" : `${trip.transfers} transfer${trip.transfers === 1 ? "" : "s"}`, `${trip.walkMinutes} min walk`];

  return (
    <li className={`surface overflow-hidden transition-shadow duration-150 ${isOnMap ? "shadow-[0_0_0_1.5px_var(--primary)]" : ""}`}>
      <button type="button" aria-expanded={isOpen} onClick={onPress} className="block w-full px-4 py-3.5 text-left transition-[background-color] duration-150 pointer-fine:hover:bg-hover">
        <span className="flex items-center justify-between gap-3">
          <span className="text-lg font-bold tabular-nums">
            {formatTime(trip.departure)} – {formatTime(trip.arrival)}
          </span>
          <span className="shrink-0 rounded-full bg-primary/12 px-2.5 py-0.5 text-sm font-semibold text-primary tabular-nums">{trip.durationMinutes} min</span>
        </span>
        <span className="mt-2 block">
          <LegSummary legs={trip.legs} />
        </span>
        {firstRide?.from.name && (
          <span className="mt-2 block text-sm text-pretty text-muted-foreground">
            Catch {firstRide.line ?? "it"} at <span className="font-semibold text-foreground">{formatTime(firstRide.departure)}</span> from {firstRide.from.name}
          </span>
        )}
        <span className="mt-2 flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{details.join(" · ")}</span>
          <span className="text-xs font-semibold text-primary">{isOpen ? "Hide" : "Steps"}</span>
          <ChevronDown aria-hidden className={`size-4 text-primary transition-[rotate] duration-200 ease-out ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>
      {/* The steps open by growing a grid row: the card's height follows the content without being measured */}
      <div inert={!isOpen} className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <Steps trip={trip} start={start} destination={destination} />
        </div>
      </div>
    </li>
  );
}

const note = "surface px-4 py-6 text-center text-sm text-pretty text-muted-foreground";

/**
 * How to get to a shift: up to three transit trips that arrive in time, or the
 * drive. Every time here comes from the backend, so the phone app agrees.
 * With room, the map stays on the left while the trips scroll on the right.
 */
export function RouteSheet({ shiftId, from: startFrom = "auto", onClose }: { shiftId: string; from?: StartChoice; onClose: () => void }) {
  const user = useUser();
  const [mode, setMode] = useState<Mode>(user.commuteMode);
  const [here, setHere] = useState<Coords | null>(null);
  // Where the trip starts when it isn't "where I am": the shift just before (the backend's default), or home
  const [start, setStart] = useState<StartChoice>(startFrom);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [onMap, setOnMap] = useState(0);
  const [open, setOpen] = useState<number | null>(null); // every trip starts closed
  const [problem, setProblem] = useState<string | null>(null); // a backend `details.code`

  const { data: shift } = useFetch(() => getShiftById(shiftId), [shiftId]);
  const routes = useFetch(async () => {
    try {
      const found = await getShiftRoutes(shiftId, { here: here ?? undefined, from: start });
      setProblem(null);
      return found;
    } catch (failure) {
      const details = (failure as HttpError).response?.data?.details as { code?: string } | undefined;
      setProblem(details?.code ?? null);
      throw failure;
    }
  }, [shiftId, here?.lat, here?.lng, start]);

  const restart = (change: () => void) => {
    setOnMap(0);
    setOpen(null);
    change();
  };
  const startAt = (from: Coords | null) => restart(() => setHere(from));
  const startFromPlace = (choice: StartChoice) =>
    restart(() => {
      setHere(null);
      setStart(choice);
    });
  const useMyLocation = () => {
    if (!navigator.geolocation) return setLocateError("This browser can’t share its location.");
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        startAt({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setLocating(false);
        setLocateError("Location is blocked for this site.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const data = routes.data;
  const trips = data?.transit.status === "ok" ? data.transit.toWork : [];
  const returnTrip = data?.transit.status === "ok" ? data.transit.toHome[0] : undefined;
  const tripOnMap = trips[Math.min(onMap, trips.length - 1)] as TransitItinerary | undefined;
  const destination = shift ? jobName(shift.job) : "Work";
  const startKind = here ? "here" : data?.from.kind;
  const leaveLabel = startKind === "home" ? "Leave home by" : startKind === "previousShift" ? `Leave ${data?.from.name} by` : "Leave by";
  const startName = startKind === "previousShift" ? data?.from.name : startKind === "home" ? "Home" : "Where you are";
  // The other place the trip could start from — one link, so the row stays a row, not a second toggle
  const switchTo: { label: string; run: () => void } | null = here
    ? { label: data?.previousShift && start !== "home" ? `Use ${data.previousShift.name}` : "Use home", run: () => startAt(null) }
    : startKind === "previousShift" && data?.hasHome
      ? { label: "From home?", run: () => startFromPlace("home") }
      : startKind === "home" && data?.previousShift
        ? { label: `From ${data.previousShift.name}`, run: () => startFromPlace("previousShift") }
        : null;

  const lines: MapLine[] =
    mode === "DRIVING" ? (data?.driving ? [{ points: data.driving.geometry }] : []) : (tripOnMap?.legs.map((leg) => ({ points: leg.geometry, color: isWalk(leg) ? WALK_COLOUR : (leg.color ?? undefined), dashed: isWalk(leg) })) ?? []);
  const pins = data
    ? [
        { latitude: data.origin.lat, longitude: data.origin.lng, color: WALK_COLOUR },
        { latitude: data.destination.lat, longitude: data.destination.lng, color: shift?.job.color },
      ]
    : [];
  const mapsLink = (kind: "driving" | "transit", text: string) =>
    data && (
      <a href={directionsUrl(data.destination, kind, here ?? (data.from.kind === "previousShift" ? data.origin : undefined))} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 pointer-fine:hover:underline">
        {text} <ExternalLink aria-hidden className="size-3.5" />
      </a>
    );

  return (
    <Sheet title="Plan your route" onClose={onClose} wide>
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* What the trip is: how, from where, to where. It stays put while the trips scroll. */}
        <div className="flex min-w-0 flex-col gap-3 md:sticky md:top-0">
          <SegmentedControl label="How you travel" options={MODES} value={mode} onChange={setMode} />

          {/* Where the trip starts: a row with one link to the other place, not a second toggle. The shift
              just before is the default — you're already out — and home is one press away for "what if". */}
          <div className="surface px-3.5 py-2.5">
            <div className="flex items-center gap-2.5">
              {startKind === "here" ? (
                <LocateFixed aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              ) : startKind === "previousShift" ? (
                <Briefcase aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <House aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              )}
              <div key={startKind} className="min-w-0 flex-1 transition-[opacity,filter] duration-150 ease-out starting:opacity-0 starting:blur-[2px]">
                <p className={label}>From</p>
                <p className="truncate text-sm font-medium">
                  {startKind === "here"
                    ? "Where you are now"
                    : startKind === "previousShift" && data
                      ? `${data.from.name} · your shift before${data.from.endsAt ? ` ends ${formatTime(data.from.endsAt)}` : ""}`
                      : user.homeLocation
                        ? `Home · ${splitAddress(user.homeLocation.address).title}`
                        : "Home"}
                </p>
              </div>
              {switchTo && (
                <button type="button" className="shrink-0 rounded-md px-1.5 py-1 text-sm font-medium text-primary transition-[scale] duration-150 ease-out active:scale-[0.97]" onClick={switchTo.run}>
                  {switchTo.label}
                </button>
              )}
            </div>
            {!here && (
              <button type="button" className="mt-1.5 ml-6.5 text-xs font-medium text-muted-foreground disabled:opacity-60 pointer-fine:hover:text-foreground" disabled={locating} onClick={useMyLocation}>
                {locating ? "Finding you…" : "Or start from where you are now"}
              </button>
            )}
          </div>
          {locateError && <p className="text-sm text-destructive">{locateError}</p>}

          {data && <MapView label="Route map" className="h-48 md:h-72" pins={pins} lines={lines} />}

          {data && shift && (
            <div className="surface flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={label}>Destination</p>
                <p className="truncate text-sm font-semibold">{destination}</p>
                {shift.job.location && <p className="truncate text-xs text-muted-foreground">{shift.job.location}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className={label}>Arrive by</p>
                <p className="text-sm font-bold text-primary tabular-nums">{formatTime(data.arriveBy)}</p>
                <p className="text-xs text-muted-foreground">{data.arrivalBufferMinutes === 0 ? "on time" : `${data.arrivalBufferMinutes} min early`}</p>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0">
          {problem === "NO_JOB_LOCATION" ? (
            <div className="surface px-6 py-8 text-center">
              <p className="text-sm text-pretty text-muted-foreground">This job doesn’t have a location yet, so there’s nowhere to route to.</p>
              {shift && (
                <Button variant="secondary" size="sm" className="mt-4" onClick={() => openSheet({ kind: "job", jobId: shift.jobId })}>
                  Set Job Location
                </Button>
              )}
            </div>
          ) : problem === "NO_ORIGIN" ? (
            <div className="surface px-6 py-8 text-center">
              <p className="text-sm text-pretty text-muted-foreground">Add your home address, or use your location, to plan a route.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => openSheet({ kind: "home" })}>
                  Add Home Address
                </Button>
                <Button variant="secondary" size="sm" busy={locating} onClick={useMyLocation}>
                  Use My Location
                </Button>
              </div>
            </div>
          ) : routes.error ? (
            <LoadError message={routes.error} onRetry={routes.retry} />
          ) : !data ? (
            <SkeletonRows rows={3} />
          ) : data.walking ? (
            <div className="surface px-4 py-3.5">
              <p className={label}>{leaveLabel}</p>
              <p className="mt-0.5 text-2xl font-bold text-primary tabular-nums">{formatTime(data.walking.leaveBy)}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Footprints aria-hidden className="size-4" />
                {data.walking.durationMinutes} min walk — close enough that there’s no bus or drive to plan.
              </p>
              {data.from.endsAt && Date.parse(data.walking.leaveBy) < Date.parse(data.from.endsAt) && (
                <p className="mt-2 text-sm text-warning-ink">
                  {data.from.name} ends at {formatTime(data.from.endsAt)}, so leave as soon as it does.
                </p>
              )}
            </div>
          ) : mode === "DRIVING" ? (
            data.driving ? (
              <>
                <div className="surface divide-y divide-border">
                  <div className="px-4 py-3.5">
                    <p className={label}>{leaveLabel}</p>
                    <p className="mt-0.5 text-2xl font-bold text-primary tabular-nums">{formatTime(data.driving.leaveBy)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {data.driving.durationMinutes} min drive · {data.driving.distanceKm.toFixed(1)} km
                    </p>
                  </div>
                  {data.driving.backHomeAround && shift && (
                    <div className="px-4 py-3.5">
                      <p className={label}>Back home around</p>
                      <p className="mt-0.5 text-base font-semibold tabular-nums">{formatTime(data.driving.backHomeAround)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {data.driving.durationMinutes} min after your shift ends ({formatTime(shift.endTime)})
                      </p>
                    </div>
                  )}
                </div>
                <p className="mt-3">{mapsLink("driving", "Open turn-by-turn directions")}</p>
              </>
            ) : (
              <p className={note}>Driving directions aren’t available for this trip right now.</p>
            )
          ) : data.transit.status === "unavailable" ? (
            <p className={note}>{data.transit.message}</p>
          ) : trips.length === 0 ? (
            <p className={note}>No bus or train gets you there for {formatTime(data.arriveBy)}. Try driving, or check a later start.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2.5">
                {trips.map((trip, index) => (
                  <TripCard
                    key={`${trip.departure}-${index}`}
                    trip={trip}
                    isOnMap={trip === tripOnMap}
                    isOpen={open === index}
                    onPress={() => {
                      setOnMap(index);
                      setOpen((current) => (current === index ? null : index));
                    }}
                    leaveLabel={leaveLabel}
                    start={startName ?? "Start"}
                    destination={destination}
                  />
                ))}
              </ul>

              {returnTrip && shift && (
                <div className="surface mt-2.5 px-4 py-3">
                  <p className={label}>Getting home after your shift</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">
                    Leave {formatTime(returnTrip.departure)} → home by {formatTime(returnTrip.arrival)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {returnTrip.durationMinutes} min · first trip after your shift ends at {formatTime(shift.endTime)}
                  </p>
                </div>
              )}

              <p className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-pretty text-muted-foreground">
                <span>Scheduled times from open transit data. Live delays aren’t included.</span>
                {mapsLink("transit", "Open in Google Maps")}
              </p>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}
