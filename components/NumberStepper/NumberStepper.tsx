import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

import styles from './number-stepper.module.css';

interface NumberStepperProps {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

const REPEAT_DELAY_MS = 420;
const REPEAT_INTERVAL_MS = 70;

function clamp(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}

/** 小数の丸め誤差（0.1+0.2 のような）を、step の桁数に合わせて丸め込む。 */
function roundToStep(value: number, step: number): number {
  const decimals = (String(step).split('.')[1] ?? '').length;
  return decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));
}

/**
 * ネイティブ `<input type="number">` のスピナー（OSごとに見た目がバラバラ）を
 * 独自の上下矢印ボタンに置き換えたもの。長押しで連続増減できる。
 */
export function NumberStepper({ id, value, min, max, step = 1, onChange }: NumberStepperProps) {
  const [draft, setDraft] = useState(String(value));
  const repeatTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (next: number): void => {
    const clamped = clamp(roundToStep(next, step), min, max);
    onChange(clamped);
  };

  const bump = (direction: 1 | -1): void => {
    commit(value + direction * step);
  };

  const stopRepeat = (): void => {
    clearTimeout(repeatTimerRef.current);
    clearInterval(repeatIntervalRef.current);
  };

  const startRepeat = (direction: 1 | -1): void => {
    bump(direction);
    repeatTimerRef.current = setTimeout(() => {
      repeatIntervalRef.current = setInterval(() => bump(direction), REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
  };

  useEffect(() => stopRepeat, []);

  return (
    <div className={styles.root}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        className={styles.input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const parsed = Number(draft);
          if (draft.trim() !== '' && !Number.isNaN(parsed)) {
            commit(parsed);
          } else {
            setDraft(String(value));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            bump(1);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            bump(-1);
          }
        }}
      />
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.stepButton}
          tabIndex={-1}
          aria-label="増やす"
          disabled={max !== undefined && value >= max}
          onPointerDown={() => startRepeat(1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
        >
          <ChevronUp size={11} />
        </button>
        <button
          type="button"
          className={styles.stepButton}
          tabIndex={-1}
          aria-label="減らす"
          disabled={min !== undefined && value <= min}
          onPointerDown={() => startRepeat(-1)}
          onPointerUp={stopRepeat}
          onPointerLeave={stopRepeat}
        >
          <ChevronDown size={11} />
        </button>
      </div>
    </div>
  );
}
