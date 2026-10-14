import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun, type LucideIcon } from 'lucide-react';
import { api } from './api';

// The forecast and the advice both come from the backend (so the web app says
// the same thing); this file fetches them and picks icons.

export type WeatherCondition = 'clear' | 'partlyCloudy' | 'cloudy' | 'fog' | 'drizzle' | 'freezingRain' | 'rain' | 'snow' | 'thunderstorm';
export type AdviceKind = 'storm' | 'ice' | 'snow' | 'rain' | 'cold' | 'heat' | 'wind' | 'fine';

export interface WeatherHour {
    time: string; // start of the hour, ISO
    temperature: number; // °C
    feelsLike: number;
    rainChance: number; // %
    precipitationMm: number;
    snowfallCm: number;
    windKmh: number;
    condition: WeatherCondition;
    conditionLabel: string;
    isDay: boolean;
}

export interface WeatherAdvice {
    kind: AdviceKind;
    title: string;
    detail: string;
}

export type WeatherUnavailableReason = 'NO_LOCATION' | 'SHIFT_OVER' | 'TOO_FAR_AHEAD' | 'PROVIDER_DOWN';

export type ShiftWeather =
    | {
        status: 'ok';
        place: { name: string; source: 'job' | 'home' };
        timeZone: string;
        atStart: WeatherHour;
        atEnd: WeatherHour | null;
        hours: WeatherHour[];
        advice: WeatherAdvice[];
    }
    | { status: 'unavailable'; reason: WeatherUnavailableReason };

/** Weather around a shift (where the job is, or at home), with what to wear or bring. */
export const getShiftWeather = async (shiftId: string): Promise<ShiftWeather> => {
    const { data } = await api.get<{ data: ShiftWeather }>(`/shifts/${shiftId}/weather`);
    return data.data;
};

export const formatDegrees = (value: number) => `${Math.round(value)}°`;

const NIGHT_ICONS: Partial<Record<WeatherCondition, LucideIcon>> = { clear: Moon, partlyCloudy: CloudMoon };
const ICONS: Record<WeatherCondition, LucideIcon> = {
    clear: Sun,
    partlyCloudy: CloudSun,
    cloudy: Cloud,
    fog: CloudFog,
    drizzle: CloudDrizzle,
    freezingRain: CloudRain,
    rain: CloudRain,
    snow: CloudSnow,
    thunderstorm: CloudLightning,
};

/** The icon for an hour — a moon, not a sun, for a clear night. */
export const weatherIcon = (hour: Pick<WeatherHour, 'condition' | 'isDay'>): LucideIcon =>
    (!hour.isDay && NIGHT_ICONS[hour.condition]) || ICONS[hour.condition];
