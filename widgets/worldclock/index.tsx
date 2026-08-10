import { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';

import { cx } from '@/lib/cx';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from './worldclock.module.css';

interface CityEntry extends Record<string, unknown> {
  label: string;
  /** IANA タイムゾーンID（例: Asia/Tokyo）。Intl.DateTimeFormat にそのまま渡す */
  timeZone: string;
}

interface WorldClockSettings extends Record<string, unknown> {
  cities: CityEntry[];
  use24Hour: boolean;
}

const MAX_CITIES = 4;

interface CityReading {
  time: string;
  /** ローカルの日付と比べて何日ズレているか（-1 / 0 / +1 など） */
  dayOffset: number;
  valid: boolean;
}

/** 指定タイムゾーンでの現在時刻を読む。不正なタイムゾーンIDでも例外を投げない。 */
function readCity(now: Date, timeZone: string, use24Hour: boolean): CityReading {
  try {
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: !use24Hour,
    }).format(now);

    // 「現地の日付」と「ローカルの日付」を YYYY-MM-DD 文字列にして引き算し、日数のズレを出す。
    const localYmd = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
    const hereYmd = new Intl.DateTimeFormat('en-CA').format(now);
    const dayOffset = Math.round(
      (new Date(`${localYmd}T00:00:00`).getTime() - new Date(`${hereYmd}T00:00:00`).getTime()) / 86_400_000,
    );

    return { time, dayOffset, valid: true };
  } catch {
    return { time: '--:--', dayOffset: 0, valid: false };
  }
}

function WorldClockWidget({ settings }: WidgetProps<WorldClockSettings>) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cities = settings.cities.slice(0, MAX_CITIES);

  if (cities.length === 0) {
    return (
      <div className={styles.empty}>
        <Globe2 size={18} />
        <span>ウィジェットの設定から都市を追加してください（最大{MAX_CITIES}件）。</span>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {cities.map((city, index) => {
        const reading = readCity(now, city.timeZone, settings.use24Hour);
        return (
          // 並べ替えは無く削除で位置が詰まるだけなのでキーは位置で十分
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className={styles.cityCell}>
            <div className={styles.cityLabel}>{city.label || city.timeZone || '?'}</div>
            <div className={cx(styles.cityTime, !reading.valid && styles.cityTimeInvalid)}>
              {reading.time}
              {reading.dayOffset !== 0 && (
                <span className={styles.dayOffset}>{reading.dayOffset > 0 ? '+1' : '-1'}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const worldClockWidget = defineWidget<WorldClockSettings>({
  type: 'world-clock',
  name: '世界時計',
  description: '最大4都市の現在時刻をコンパクトにまとめて表示します。',
  icon: Globe2,
  defaultLayout: { w: 3, h: 2, minW: 2, minH: 1 },
  defaultSettings: {
    cities: [
      { label: 'Tokyo', timeZone: 'Asia/Tokyo' },
      { label: 'New York', timeZone: 'America/New_York' },
      { label: 'London', timeZone: 'Europe/London' },
      { label: 'Sydney', timeZone: 'Australia/Sydney' },
    ],
    use24Hour: true,
  },
  settingsSchema: [
    {
      kind: 'list',
      key: 'cities',
      label: '都市一覧',
      addLabel: '都市を追加',
      maxItems: MAX_CITIES,
      itemFields: [
        { kind: 'text', key: 'label', label: '表示名', placeholder: '例: Tokyo' },
        {
          kind: 'text',
          key: 'timeZone',
          label: 'タイムゾーンID',
          placeholder: 'Asia/Tokyo',
          help: 'IANAタイムゾーンID（例: Asia/Tokyo, America/New_York, Europe/London）で入力してください。',
        },
      ],
    },
    { kind: 'toggle', key: 'use24Hour', label: '24時間表示' },
  ],
  Component: WorldClockWidget,
});
