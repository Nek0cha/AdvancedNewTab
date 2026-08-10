/**
 * Open-Meteo との通信。APIキー不要・CORS対応・非商用無料のため、
 * ユーザーにキー登録を強いずに天気ウィジェットを成立させられる（設計プラン参照）。
 * https://open-meteo.com/
 */

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from 'lucide-react';

export type NameLanguage = 'en' | 'ja';

export interface GeocodeResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

export interface WeatherSnapshot {
  place: string;
  temperature: number;
  apparentTemperature: number;
  weatherCode: number;
  humidity: number;
  windSpeed: number;
  isDay: boolean;
}

/** 地名から緯度経度を引く。複数該当する場合は最初の候補を採用する。 */
export async function geocodeCity(
  query: string,
  language: NameLanguage,
): Promise<GeocodeResult | null> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', language);
  url.searchParams.set('format', 'json');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`地名の検索に失敗しました（${res.status}）`);
  const body = (await res.json()) as { results?: GeocodeResult[] };
  return body.results?.[0] ?? null;
}

/** 地名の表示形式を組み立てる。英語は「都市, 国」、日本語は「都市 都道府県」（重複時は省略）。 */
function formatPlaceName(place: GeocodeResult, language: NameLanguage): string {
  if (language === 'en') {
    return [place.name, place.country].filter(Boolean).join(', ');
  }
  // 東京都のように地名と都道府県名が一致する場合、そのまま連結すると重複するため除く
  return [place.name, place.admin1 !== place.name ? place.admin1 : null].filter(Boolean).join(' ');
}

export async function fetchWeather(
  place: GeocodeResult,
  unit: 'celsius' | 'fahrenheit',
  language: NameLanguage,
): Promise<WeatherSnapshot> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(place.latitude));
  url.searchParams.set('longitude', String(place.longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m,is_day',
  );
  url.searchParams.set('temperature_unit', unit);
  url.searchParams.set('timezone', 'auto');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`天気の取得に失敗しました（${res.status}）`);
  const body = (await res.json()) as {
    current: {
      temperature_2m: number;
      apparent_temperature: number;
      weather_code: number;
      relative_humidity_2m: number;
      wind_speed_10m: number;
      is_day: number;
    };
  };

  return {
    place: formatPlaceName(place, language),
    temperature: body.current.temperature_2m,
    apparentTemperature: body.current.apparent_temperature,
    weatherCode: body.current.weather_code,
    humidity: body.current.relative_humidity_2m,
    windSpeed: body.current.wind_speed_10m,
    isDay: body.current.is_day === 1,
  };
}

/** WMO Weather interpretation codes をアイコンと日本語の短い説明に変換する。 */
export function describeWeatherCode(
  code: number,
  isDay: boolean,
): { Icon: LucideIcon; label: string } {
  const table: Record<number, { icon: LucideIcon; nightIcon?: LucideIcon; label: string }> = {
    0: { icon: Sun, nightIcon: Moon, label: '快晴' },
    1: { icon: CloudSun, nightIcon: CloudMoon, label: 'ほぼ晴れ' },
    2: { icon: CloudSun, nightIcon: CloudMoon, label: '晴れ時々曇り' },
    3: { icon: Cloud, label: '曇り' },
    45: { icon: CloudFog, label: '霧' },
    48: { icon: CloudFog, label: '霧氷' },
    51: { icon: CloudDrizzle, label: '弱い霧雨' },
    53: { icon: CloudDrizzle, label: '霧雨' },
    55: { icon: CloudDrizzle, label: '強い霧雨' },
    56: { icon: CloudDrizzle, label: '着氷性の霧雨' },
    57: { icon: CloudDrizzle, label: '強い着氷性の霧雨' },
    61: { icon: CloudRain, label: '弱い雨' },
    63: { icon: CloudRain, label: '雨' },
    65: { icon: CloudRain, label: '強い雨' },
    66: { icon: CloudRain, label: '着氷性の雨' },
    67: { icon: CloudRain, label: '強い着氷性の雨' },
    71: { icon: CloudSnow, label: '弱い雪' },
    73: { icon: CloudSnow, label: '雪' },
    75: { icon: CloudSnow, label: '強い雪' },
    77: { icon: CloudSnow, label: '雪あられ' },
    80: { icon: CloudDrizzle, label: 'にわか雨' },
    81: { icon: CloudRain, label: '強めのにわか雨' },
    82: { icon: CloudRain, label: '激しいにわか雨' },
    85: { icon: CloudSnow, label: 'にわか雪' },
    86: { icon: CloudSnow, label: '強いにわか雪' },
    95: { icon: CloudLightning, label: '雷雨' },
    96: { icon: CloudLightning, label: '雷雨（ひょうを伴う）' },
    99: { icon: CloudLightning, label: '激しい雷雨（ひょうを伴う）' },
  };
  const entry = table[code] ?? { icon: Cloud, label: '不明' };
  return { Icon: !isDay && entry.nightIcon ? entry.nightIcon : entry.icon, label: entry.label };
}
