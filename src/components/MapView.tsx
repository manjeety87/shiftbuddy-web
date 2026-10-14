"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";

export interface MapPin {
  latitude: number;
  longitude: number;
  /** CSS colour; defaults to the theme accent */
  color?: string;
}

export interface MapLine {
  points: [number, number][]; // [lat, lng]
  color?: string;
  dashed?: boolean;
}

interface MapViewProps {
  pins?: MapPin[];
  lines?: MapLine[];
  /** Clicking the map picks that point */
  onPick?: (latitude: number, longitude: number) => void;
  className?: string;
  label: string;
}

const TORONTO: [number, number] = [43.6532, -79.3832]; // where a map with nothing on it opens
const accent = () => getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#6b8f71";

/**
 * OpenStreetMap through Leaflet, the same provider as the mobile app. Leaflet
 * needs `window`, so it loads in the browser only; pins are drawn as circles
 * (its image markers break under bundlers).
 */
export function MapView({ pins = [], lines = [], onPick, className = "h-56", label }: MapViewProps) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const latestPick = useRef(onPick);
  useEffect(() => {
    latestPick.current = onPick;
  });

  const drawing = JSON.stringify({ pins, lines });

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    import("leaflet").then((L) => {
      if (cancelled || !holder.current) return;
      if (!map.current) {
        map.current = L.map(holder.current, { zoomControl: true, attributionControl: true }).setView(TORONTO, 11);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map.current);
        map.current.on("click", (event) => latestPick.current?.(event.latlng.lat, event.latlng.lng));
      }
      const view = map.current;
      view.eachLayer((layer) => {
        if (!(layer instanceof L.TileLayer)) view.removeLayer(layer);
      });

      const shown = JSON.parse(drawing) as { pins: MapPin[]; lines: MapLine[] };
      const corners: [number, number][] = [];
      shown.lines.forEach((line) => {
        if (line.points.length < 2) return;
        L.polyline(line.points, { color: line.color ?? accent(), weight: 5, opacity: 0.85, dashArray: line.dashed ? "2 9" : undefined }).addTo(view);
        corners.push(...line.points);
      });
      shown.pins.forEach((pin) => {
        L.circleMarker([pin.latitude, pin.longitude], { radius: 8, color: "#ffffff", weight: 3, fillColor: pin.color ?? accent(), fillOpacity: 1 }).addTo(view);
        corners.push([pin.latitude, pin.longitude]);
      });

      // Fit once the map knows its real size: a sheet is still sliding in when this
      // first runs, and a fit worked out at 0×0 zooms into a corner
      const frame = () => {
        view.invalidateSize();
        if (corners.length === 1) view.setView(corners[0], 15, { animate: false });
        else if (corners.length > 1) view.fitBounds(L.latLngBounds(corners), { padding: [28, 28], animate: false });
      };
      frame();
      observer = new ResizeObserver(frame);
      observer.observe(holder.current);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [drawing]);

  useEffect(
    () => () => {
      map.current?.remove();
      map.current = null;
    },
    [],
  );

  return <div ref={holder} role="application" aria-label={label} className={`z-0 w-full overflow-hidden rounded-xl ${onPick ? "cursor-crosshair" : ""} ${className}`} />;
}
