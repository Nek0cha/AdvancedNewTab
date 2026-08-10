import { useEffect, useRef, useState } from 'react';

import { cx } from '@/lib/cx';

import styles from './marquee.module.css';

interface MarqueeProps {
  text: string;
  className?: string;
}

/**
 * 駅の電光掲示板のように、文字がはみ出るときだけ横に流れるテキスト。
 *
 * 常時アニメーションさせるのではなく、実際にコンテナ幅をはみ出た場合だけ
 * 有効化する。中身を2つ並べて -50% までスライドさせることで、
 * 継ぎ目の見えないループを作っている。
 */
export function Marquee({ text, className }: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [duration, setDuration] = useState(8);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const measure = (): void => {
      const over = textEl.scrollWidth > container.clientWidth;
      setOverflowing(over);
      // 長い文字列ほど速く流れすぎないよう、幅に応じて秒数を伸ばす
      setDuration(Math.max(6, textEl.scrollWidth / 40));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(textEl);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div ref={containerRef} className={cx(styles.viewport, className)}>
      <div
        className={cx(styles.track, overflowing && styles.scrolling)}
        style={overflowing ? { animationDuration: `${duration}s` } : undefined}
      >
        <span ref={textRef} className={styles.item}>
          {text}
        </span>
        {overflowing && (
          <span className={styles.item} aria-hidden>
            {text}
          </span>
        )}
      </div>
    </div>
  );
}
