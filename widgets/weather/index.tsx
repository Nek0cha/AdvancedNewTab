import { useEffect, useState } from 'react';
import { CloudSun, Loader2 } from 'lucide-react';

import { PermissionGate } from '@/components/PermissionGate/PermissionGate';
import { cached } from '@/lib/cache';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import { describeWeatherCode, fetchWeather, geocodeCity, type NameLanguage, type WeatherSnapshot } from './open-meteo';
import styles from './weather.module.css';

interface WeatherSettings extends Record<string, unknown> {
  cityName: string;
  tempUnit: 'celsius' | 'fahrenheit';
  /** 地名の表示言語。英語がデフォルト（例: "Osaka, Japan"）。 */
  nameLanguage: NameLanguage;
}

/** 天気は分単位でしか変わらないため、この間隔は使い回す。 */
const WEATHER_TTL_MS = 30 * 60 * 1000;

function WeatherContent({ settings }: WidgetProps<WeatherSettings>) {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!settings.cityName.trim()) {
      setError('地名が未設定です');
      return;
    }

    let cancelled = false;
    setError(null);

    const key = `weather:${settings.cityName}:${settings.tempUnit}:${settings.nameLanguage}`;
    cached(key, WEATHER_TTL_MS, async () => {
      const place = await geocodeCity(settings.cityName, settings.nameLanguage);
      if (!place) throw new Error(`「${settings.cityName}」が見つかりませんでした`);
      return fetchWeather(place, settings.tempUnit, settings.nameLanguage);
    })
      .then((result) => {
        if (cancelled) return;
        setSnapshot(result.data);
        setStale(result.stale);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [settings.cityName, settings.tempUnit, settings.nameLanguage]);

  if (error) {
    return <div className={styles.empty}>{error}</div>;
  }
  if (!snapshot) {
    return (
      <div className={styles.loading}>
        <Loader2 size={20} className={styles.spinner} aria-hidden />
        <span>読み込み中…</span>
      </div>
    );
  }

  const { Icon, label } = describeWeatherCode(snapshot.weatherCode, snapshot.isDay);
  const unitSuffix = settings.tempUnit === 'celsius' ? '℃' : '℉';

  return (
    <div className={styles.root}>
      <Icon size={40} strokeWidth={1.5} className={styles.icon} />
      <span className={styles.temperature}>
        {Math.round(snapshot.temperature)}
        {unitSuffix}
      </span>
      <span className={styles.place}>
        {snapshot.place} ・ {label}
      </span>
      <span className={styles.detail}>
        <span>体感 {Math.round(snapshot.apparentTemperature)}{unitSuffix}</span>
        <span>湿度 {snapshot.humidity}%</span>
      </span>
      {stale && <span className={styles.staleBadge}>オフラインのため前回取得時点の情報です</span>}
    </div>
  );
}

function WeatherWidget(props: WidgetProps<WeatherSettings>) {
  return (
    <PermissionGate
      permissions={{ hosts: ['https://api.open-meteo.com/*', 'https://geocoding-api.open-meteo.com/*'] }}
      reason="天気を表示するには、Open-Meteo（天気情報サービス）への通信を許可してください。"
    >
      <WeatherContent {...props} />
    </PermissionGate>
  );
}

export const weatherWidget = defineWidget<WeatherSettings>({
  type: 'weather',
  name: '天気',
  description: '指定した地名の現在の天気を表示します（Open-Meteo提供）。',
  icon: CloudSun,
  defaultLayout: { w: 3, h: 3, minW: 2, minH: 2 },
  permissions: { hosts: ['https://api.open-meteo.com/*', 'https://geocoding-api.open-meteo.com/*'] },
  defaultSettings: { cityName: 'Tokyo', tempUnit: 'celsius', nameLanguage: 'en' },
  settingsSchema: [
    {
      kind: 'text',
      key: 'cityName',
      label: '地名',
      placeholder: '例: Tokyo, Osaka, New York',
      // Open-Meteo の地名検索は漢字表記だと該当しないことが多く、
      // ローマ字（英語表記）の方が確実にヒットする。
      help: '漢字よりローマ字表記（Tokyo, Osakaなど）の方が見つかりやすいです。',
    },
    {
      kind: 'select',
      key: 'nameLanguage',
      label: '地名の表示言語',
      options: [
        { value: 'en', label: '英語（例: Osaka, Japan）' },
        { value: 'ja', label: '日本語（例: 大阪府 大阪市）' },
      ],
    },
    {
      kind: 'select',
      key: 'tempUnit',
      label: '気温の単位',
      options: [
        { value: 'celsius', label: '摂氏（℃）' },
        { value: 'fahrenheit', label: '華氏（℉）' },
      ],
    },
  ],
  Component: WeatherWidget,
});
