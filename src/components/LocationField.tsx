"use client";

import { LocateFixed, MapPin, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { Place } from "@/interfaces/user.d";
import { errorMessage } from "@/lib/api";
import { reverseGeocode, searchPlaces, splitAddress } from "@/lib/geocode";
import { MapView } from "./MapView";
import { Button, Spinner } from "./ui/Button";
import { inputClass, SectionLabel } from "./ui/Field";

const SEARCH_DELAY_MS = 300;

/**
 * Pick a place: type to search (results arrive as you type), use this device's
 * location, or click the map. Nothing is chosen by default — no pin until the
 * person picks one.
 */
export function LocationField({ label, value, onChange, near }: { label: string; value: Place | null; onChange: (place: Place | null) => void; near?: { latitude: number; longitude: number } }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [busy, setBusy] = useState<"search" | "locate" | "pin" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestSearch = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- too short to search: clear the old list
      setResults(null);
      return;
    }
    const searchId = ++latestSearch.current;
    const timer = setTimeout(async () => {
      setBusy("search");
      try {
        const found = await searchPlaces(text, near);
        if (searchId !== latestSearch.current) return; // a newer search is already out
        setResults(found);
        setError(null);
      } catch (failure) {
        if (searchId === latestSearch.current) setError(errorMessage(failure, "Address search isn’t available right now."));
      } finally {
        if (searchId === latestSearch.current) setBusy(null);
      }
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
    // `near` only ranks results; a new object each render must not restart the search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const choose = (place: Place) => {
    onChange(place);
    setQuery("");
    setResults(null);
    setError(null);
  };

  const pinAt = async (latitude: number, longitude: number, kind: "locate" | "pin") => {
    setBusy(kind);
    try {
      choose(await reverseGeocode(latitude, longitude));
    } catch {
      // The spot is still good without a street name
      choose({ address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, latitude, longitude });
    } finally {
      setBusy(null);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError("This browser can’t share its location.");
    setBusy("locate");
    navigator.geolocation.getCurrentPosition(
      (position) => pinAt(position.coords.latitude, position.coords.longitude, "locate"),
      () => {
        setBusy(null);
        setError("Location is blocked for this site. Search for the address instead.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const chosen = value ? splitAddress(value.address) : null;

  return (
    <div className="mb-4">
      <SectionLabel>{label}</SectionLabel>
      {value && chosen && (
        <div className="mb-2 flex items-center gap-3 surface px-3.5 py-3">
          <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{chosen.title}</span>
            {chosen.detail && <span className="block truncate text-xs text-muted-foreground">{chosen.detail}</span>}
          </span>
          <button type="button" aria-label="Remove this location" onClick={() => onChange(null)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground pointer-fine:hover:bg-muted/60">
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}

      <div className="relative">
        <input
          id={id}
          aria-label={`Search for ${label.toLowerCase()}`}
          className={inputClass}
          placeholder={value ? "Search for a different address" : "Search for an address or place"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
        />
        {busy === "search" && <Spinner className="absolute top-3 right-3 size-4 text-muted-foreground md:top-2 md:right-2.5" />}
      </div>

      {results && (
        <ul className="mt-2 divide-y divide-border overflow-hidden surface">
          {results.length === 0 && <li className="px-3.5 py-3 text-sm text-muted-foreground">Nothing found for “{query.trim()}”. Try the street address.</li>}
          {results.map((place) => {
            const { title, detail } = splitAddress(place.address);
            return (
              <li key={`${place.latitude},${place.longitude}`}>
                <button type="button" onClick={() => choose(place)} className="block w-full px-3.5 py-2.5 text-left row-hover">
                  <span className="block truncate text-sm font-medium">{title}</span>
                  {detail && <span className="block truncate text-xs text-muted-foreground">{detail}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Button variant="secondary" size="sm" icon={<LocateFixed aria-hidden className="size-3.5" />} busy={busy === "locate"} onClick={useMyLocation}>
          Use My Location
        </Button>
        <span className="text-xs text-muted-foreground">{busy === "pin" ? "Finding that address…" : "or click the map"}</span>
      </div>

      <MapView label={`Map for ${label.toLowerCase()}`} className="mt-2 h-44" pins={value ? [value] : []} onPick={(latitude, longitude) => pinAt(latitude, longitude, "pin")} />
    </div>
  );
}
