import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';

import { cx } from '@/lib/cx';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from './pomodoro.module.css';

interface PomodoroSettings extends Record<string, unknown> {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** この回数だけ作業を終えたら、次の休憩は長い休憩になる */
  roundsBeforeLongBreak: number;
}

type Phase = 'work' | 'short' | 'long';

const PHASE_LABEL: Record<Phase, string> = {
  work: '作業中',
  short: '小休憩',
  long: '長休憩',
};

function phaseMinutes(phase: Phase, settings: PomodoroSettings): number {
  if (phase === 'work') return settings.workMinutes;
  if (phase === 'short') return settings.shortBreakMinutes;
  return settings.longBreakMinutes;
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * ウィジェット自体のインスタンスIDごとに独立したタイマー状態を持たせたいが、
 * 「作業中に他ウィジェットの設定を開いて戻ってきたら振り出しに戻っていた」を避けるため、
 * 状態は永続化せずコンポーネントのローカル state に留める（タブを閉じたらリセットされる、
 * キッチンタイマー的な割り切り）。
 */
function PomodoroWidget({ settings }: WidgetProps<PomodoroSettings>) {
  const [phase, setPhase] = useState<Phase>('work');
  const [remaining, setRemaining] = useState(() => settings.workMinutes * 60);
  const [running, setRunning] = useState(false);
  const [completedRounds, setCompletedRounds] = useState(0);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // 作業/休憩の分数設定が変わったら、今のフェーズの残り時間も設定値に追従させる
  // （タイマー稼働中に設定を変えても壊れないようにするため、稼働中は変えない）。
  useEffect(() => {
    if (running) return;
    setRemaining(phaseMinutes(phase, settings) * 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.workMinutes, settings.shortBreakMinutes, settings.longBreakMinutes]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev > 1) return prev - 1;

        // このフェーズを終えて次のフェーズへ。setState の中で直接 setPhase 等を
        // 呼びたいので、useEffect の外に出さずここで完結させる。
        const current = settingsRef.current;
        setPhase((prevPhase) => {
          let nextPhase: Phase;
          if (prevPhase === 'work') {
            const nextCompleted = completedRounds + 1;
            setCompletedRounds(nextCompleted);
            nextPhase = nextCompleted % current.roundsBeforeLongBreak === 0 ? 'long' : 'short';
          } else {
            nextPhase = 'work';
          }
          setRemaining(phaseMinutes(nextPhase, current) * 60);
          return nextPhase;
        });
        return 0;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, completedRounds]);

  const totalForPhase = phaseMinutes(phase, settings) * 60;
  const progress = totalForPhase > 0 ? 1 - remaining / totalForPhase : 0;

  const reset = (): void => {
    setRunning(false);
    setPhase('work');
    setCompletedRounds(0);
    setRemaining(settings.workMinutes * 60);
  };

  return (
    <div className={styles.root}>
      <div className={cx(styles.phaseLabel, styles[phase])}>{PHASE_LABEL[phase]}</div>
      <div className={styles.time}>{formatMMSS(remaining)}</div>

      <div className={styles.progressTrack}>
        <div className={cx(styles.progressFill, styles[phase])} style={{ width: `${progress * 100}%` }} />
      </div>

      <div className={styles.rounds}>
        {Array.from({ length: settings.roundsBeforeLongBreak }, (_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={i} className={cx(styles.roundDot, i < completedRounds % settings.roundsBeforeLongBreak && styles.roundDotDone)} />
        ))}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={cx(styles.controlButton, styles.playButton, 'ant-no-drag')}
          title={running ? '一時停止' : '開始'}
          onClick={() => setRunning((v) => !v)}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          type="button"
          className={cx(styles.controlButton, 'ant-no-drag')}
          title="最初からやり直す"
          onClick={reset}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}

export const pomodoroWidget = defineWidget<PomodoroSettings>({
  type: 'pomodoro',
  name: 'ポモドーロタイマー',
  description: '作業と休憩を交互に繰り返すタイマーです。',
  icon: Timer,
  defaultLayout: { w: 3, h: 3, minW: 2, minH: 3 },
  defaultSettings: {
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    roundsBeforeLongBreak: 4,
  },
  settingsSchema: [
    { kind: 'number', key: 'workMinutes', label: '作業時間（分）', min: 1, max: 180, step: 1 },
    { kind: 'number', key: 'shortBreakMinutes', label: '小休憩の時間（分）', min: 1, max: 60, step: 1 },
    { kind: 'number', key: 'longBreakMinutes', label: '長休憩の時間（分）', min: 1, max: 120, step: 1 },
    {
      kind: 'number',
      key: 'roundsBeforeLongBreak',
      label: '長休憩までの作業回数',
      min: 1,
      max: 12,
      step: 1,
    },
  ],
  Component: PomodoroWidget,
});
