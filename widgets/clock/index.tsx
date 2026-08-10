import { useEffect, useState } from 'react';
import { Clock as ClockIcon } from 'lucide-react';

import {
  getWidgetBackgroundStyle,
  WIDGET_BACKGROUND_DEFAULTS,
  WIDGET_BACKGROUND_FIELDS,
  type WidgetBackgroundSettings,
} from '@/lib/widget-background';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import { AnalogClock } from './AnalogClock';
import styles from './clock.module.css';
import { DATE_FORMAT_OPTIONS, formatClockDate, type DateFormat } from './format-date';

interface ClockSettings extends Record<string, unknown>, WidgetBackgroundSettings {
  mode: 'digital' | 'analog';
  use24Hour: boolean;
  /** デジタル表示の秒 / アナログの秒針、どちらにも使う */
  showSeconds: boolean;
  showDate: boolean;
  dateFormat: DateFormat;
  /** 文字サイズの倍率。1 のとき 3rem 相当（デジタル表示のみ） */
  fontScale: number;
}

/**
 * 次の秒の頭に合わせて更新する。
 * 単純な setInterval(1000) では端末の負荷で表示が徐々にずれるため、
 * 毎回「次の秒までの残り」を計算して setTimeout を張り直している。
 */
function useNow(tickEverySecond: boolean): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = (): void => {
      const current = new Date();
      setNow(current);
      const period = tickEverySecond ? 1000 : 60_000;
      const delay = period - (current.getTime() % period);
      timer = setTimeout(schedule, delay);
    };

    schedule();
    return () => clearTimeout(timer);
  }, [tickEverySecond]);

  return now;
}

function ClockWidget({ settings }: WidgetProps<ClockSettings>) {
  const now = useNow(settings.showSeconds);
  const dateText = settings.showDate ? formatClockDate(now, settings.dateFormat) : null;
  const backgroundStyle = getWidgetBackgroundStyle(settings);

  if (settings.mode === 'analog') {
    return (
      <div className={styles.root} style={backgroundStyle}>
        <div className={styles.analogWrap}>
          <AnalogClock now={now} showSeconds={settings.showSeconds} />
        </div>
        {dateText && <div className={styles.date}>{dateText}</div>}
      </div>
    );
  }

  const hours = settings.use24Hour
    ? String(now.getHours()).padStart(2, '0')
    : String(now.getHours() % 12 || 12);
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const meridiem = now.getHours() < 12 ? 'AM' : 'PM';

  return (
    <div className={styles.root} style={backgroundStyle}>
      <div className={styles.time} style={{ fontSize: `${3 * settings.fontScale}rem` }}>
        {hours}:{minutes}
        {settings.showSeconds && <span className={styles.seconds}>{seconds}</span>}
        {!settings.use24Hour && <span className={styles.meridiem}>{meridiem}</span>}
      </div>
      {dateText && (
        <div className={styles.date} style={{ fontSize: `${0.95 * settings.fontScale}rem` }}>
          {dateText}
        </div>
      )}
    </div>
  );
}

export const clockWidget = defineWidget<ClockSettings>({
  type: 'clock',
  name: '時計',
  description: '現在時刻と日付を表示します（デジタル/アナログ）。',
  icon: ClockIcon,
  frame: 'bare',
  defaultLayout: { w: 4, h: 2, minW: 2, minH: 1 },
  defaultSettings: {
    mode: 'digital',
    use24Hour: true,
    showSeconds: false,
    showDate: true,
    dateFormat: 'en-long',
    fontScale: 1,
    ...WIDGET_BACKGROUND_DEFAULTS,
  },
  settingsSchema: [
    {
      kind: 'select',
      key: 'mode',
      label: '表示形式',
      options: [
        { value: 'digital', label: 'デジタル' },
        { value: 'analog', label: 'アナログ' },
      ],
    },
    { kind: 'toggle', key: 'use24Hour', label: '24時間表示（デジタルのみ）' },
    { kind: 'toggle', key: 'showSeconds', label: '秒を表示（アナログは秒針）' },
    { kind: 'toggle', key: 'showDate', label: '日付を表示' },
    {
      kind: 'select',
      key: 'dateFormat',
      label: '日付の表記',
      options: DATE_FORMAT_OPTIONS,
    },
    {
      kind: 'number',
      key: 'fontScale',
      label: '文字サイズ倍率（デジタルのみ）',
      min: 0.4,
      max: 4,
      step: 0.1,
      help: '1.0 で標準サイズです。',
    },
    ...WIDGET_BACKGROUND_FIELDS,
  ],
  Component: ClockWidget,
});
