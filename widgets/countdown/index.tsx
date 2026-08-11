import { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';

import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from './countdown.module.css';

interface CountdownSettings extends Record<string, unknown> {
  /**
   * detailed: 日時（分単位）まで指定し、日/時間/分/秒の内訳を表示する。
   * dateOnly: 日付だけを指定し、「あと○○日」だけをコンパクトに表示する。
   */
  mode: 'detailed' | 'dateOnly';
  title: string;
  /** detailed モード用。<input type="datetime-local"> 相当の文字列（例: 2026-12-31T00:00） */
  targetDateTime: string;
  /** dateOnly モード用。YYYY-MM-DD */
  targetDate: string;
  showSeconds: boolean;
}

interface Duration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function splitDuration(ms: number): Duration {
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * 「あと○○日」を、時刻を無視したカレンダー上の日付の差で数える。
 * ミリ秒の差を単純に86400000で割ると、時刻によっては1日ズレて見える
 * （例: 23時に「明日」を指定すると、実際の差は数時間なのに1日と表示される方が
 * 直感的なので、日付部分だけを比較する）。
 */
function dateOnlyDiffDays(targetDateStr: string): number {
  const target = new Date(`${targetDateStr}T00:00:00`);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / 86_400_000);
}

function DateOnlyView({ settings }: { settings: CountdownSettings }) {
  const [, forceTick] = useState(0);

  // 日付が変わった瞬間に表示を更新したいだけなので、分単位の間隔で十分。
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!settings.targetDate || Number.isNaN(new Date(`${settings.targetDate}T00:00:00`).getTime())) {
    return (
      <div className={styles.empty}>
        <Hourglass size={18} />
        <span>ウィジェットの設定から、目標の日付を指定してください。</span>
      </div>
    );
  }

  const diff = dateOnlyDiffDays(settings.targetDate);

  return (
    <div className={styles.compactRoot}>
      {settings.title && <div className={styles.compactTitle}>{settings.title}</div>}
      {diff === 0 ? (
        <div className={styles.compactValue}>今日</div>
      ) : diff > 0 ? (
        <div className={styles.compactValue}>
          あと<span className={styles.compactNumber}>{diff}</span>日
        </div>
      ) : (
        <div className={styles.compactValue}>
          <span className={styles.compactNumber}>{-diff}</span>日経過
        </div>
      )}
    </div>
  );
}

function DetailedView({ settings }: { settings: CountdownSettings }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const target = new Date(settings.targetDateTime).getTime();

  if (!settings.targetDateTime || Number.isNaN(target)) {
    return (
      <div className={styles.empty}>
        <Hourglass size={20} />
        <span>ウィジェットの設定から、目標の日時を指定してください。</span>
      </div>
    );
  }

  const diff = target - now;
  const isFuture = diff >= 0;
  const { days, hours, minutes, seconds } = splitDuration(Math.abs(diff));

  return (
    <div className={styles.root}>
      {settings.title && <div className={styles.title}>{settings.title}</div>}
      <div className={styles.units}>
        <div className={styles.unit}>
          <span className={styles.value}>{days}</span>
          <span className={styles.label}>日</span>
        </div>
        <div className={styles.unit}>
          <span className={styles.value}>{pad2(hours)}</span>
          <span className={styles.label}>時間</span>
        </div>
        <div className={styles.unit}>
          <span className={styles.value}>{pad2(minutes)}</span>
          <span className={styles.label}>分</span>
        </div>
        {settings.showSeconds && (
          <div className={styles.unit}>
            <span className={styles.value}>{pad2(seconds)}</span>
            <span className={styles.label}>秒</span>
          </div>
        )}
      </div>
      <div className={styles.mode}>{isFuture ? 'まで' : '経過'}</div>
    </div>
  );
}

function CountdownWidget({ settings }: WidgetProps<CountdownSettings>) {
  return settings.mode === 'dateOnly' ? <DateOnlyView settings={settings} /> : <DetailedView settings={settings} />;
}

export const countdownWidget = defineWidget<CountdownSettings>({
  type: 'countdown',
  name: 'カウントダウン / カウントアップ',
  description: '指定した日時までの残り時間、または過ぎてからの経過時間を表示します。',
  icon: Hourglass,
  defaultLayout: { w: 4, h: 2, minW: 2, minH: 1 },
  defaultSettings: {
    mode: 'dateOnly',
    title: '',
    targetDateTime: '',
    targetDate: '',
    showSeconds: true,
  },
  settingsSchema: [
    { kind: 'text', key: 'title', label: 'タイトル（任意）', placeholder: '例: 誕生日まで' },
    {
      kind: 'select',
      key: 'mode',
      label: '表示モード',
      variant: 'tabs',
      options: [
        { value: 'dateOnly', label: 'コンパクト' },
        { value: 'detailed', label: '詳細' },
      ],
      help: 'コンパクトは「あと○○日」だけを表示、詳細は日・時間・分・秒の内訳まで表示します。',
    },
    {
      kind: 'text',
      key: 'targetDate',
      label: '目標の日付',
      placeholder: '2026-12-31',
      help: '「YYYY-MM-DD」の形式で入力してください。',
      visibleWhen: { key: 'mode', equals: 'dateOnly' },
    },
    {
      kind: 'text',
      key: 'targetDateTime',
      label: '目標の日時',
      placeholder: '2026-12-31T00:00',
      help: '「YYYY-MM-DDTHH:mm」の形式で入力してください。過去の日時を指定すると経過時間の表示に切り替わります。',
      visibleWhen: { key: 'mode', equals: 'detailed' },
    },
    {
      kind: 'toggle',
      key: 'showSeconds',
      label: '秒も表示する',
      visibleWhen: { key: 'mode', equals: 'detailed' },
    },
  ],
  Component: CountdownWidget,
});
