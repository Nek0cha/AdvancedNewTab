import { useEffect, useState } from 'react';

import type { BackgroundConfig } from '@/lib/types';

import styles from './background-image.module.css';

/**
 * 今どの画像を出しているかの控え。新しいタブを開くたびに「次の1枚」を選ぶには、
 * 前のタブで何を出したかを覚えておく必要がある。
 *
 * PersistedState（lib/store.ts）には入れない。入れると、新しいタブを開くたびに
 * 設定の書き込みと Undo の履歴が1つ増え、他のタブにも変更として伝わってしまうため。
 * 消えても「最初の1枚から出し直す」だけで済む表示上の控えなので、localStorage で十分。
 */
const SLIDESHOW_KEY = 'ant:slideshow';

interface SlideshowMemo {
  index: number;
  /** その画像に切り替えた時刻（ms） */
  changedAt: number;
}

function readMemo(): SlideshowMemo | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SLIDESHOW_KEY) ?? 'null') as Partial<SlideshowMemo> | null;
    return raw && typeof raw.index === 'number' && typeof raw.changedAt === 'number'
      ? { index: raw.index, changedAt: raw.changedAt }
      : null;
  } catch {
    return null;
  }
}

function writeMemo(memo: SlideshowMemo): void {
  try {
    localStorage.setItem(SLIDESHOW_KEY, JSON.stringify(memo));
  } catch {
    // 書けなくても、次に開いたときに最初の1枚から出し直すだけ
  }
}

/** 次の1枚を選ぶ。シャッフルでも、同じ画像が2回続かないようにする。 */
function nextIndex(current: number, count: number, shuffle: boolean): number {
  if (count <= 1) return 0;
  if (!shuffle) return (current + 1) % count;
  const pick = Math.floor(Math.random() * (count - 1));
  return pick >= current ? pick + 1 : pick;
}

/**
 * 表示する画像を決める。interval が 0 なら開くたびに次へ、そうでなければ前回の切り替えから
 * interval 分たっていれば次へ進み、まだなら同じ画像を出し続ける。
 */
function pickOnOpen(count: number, intervalMinutes: number, shuffle: boolean): SlideshowMemo {
  const now = Date.now();
  const memo = readMemo();
  const valid = memo && memo.index < count ? memo : null;
  let next: SlideshowMemo;
  if (!valid) {
    next = { index: shuffle ? Math.floor(Math.random() * count) : 0, changedAt: now };
  } else if (intervalMinutes === 0 || now - valid.changedAt >= intervalMinutes * 60_000) {
    next = { index: nextIndex(valid.index, count, shuffle), changedAt: now };
  } else {
    next = valid;
  }
  writeMemo(next);
  return next;
}

/** 背景画像の層。スライドショーが有効なら複数の画像を切り替え、そうでなければ1枚を出す。 */
export function BackgroundImage({ image }: { image: BackgroundConfig['image'] }) {
  const { slideshow } = image;
  const images = slideshow.enabled ? slideshow.images : [];
  const useSlides = images.length > 0;

  const [memo, setMemo] = useState<SlideshowMemo | null>(null);
  // 切り替わる直前の画像。新しい画像がフェードインし終わるまで下に残しておかないと、
  // 一瞬だけ下地の色が見えてチラついてしまう。
  const [previous, setPrevious] = useState<string | null>(null);

  // 開いたときに1回だけ選ぶ。画像の枚数や間隔を変えたときも選び直す。
  useEffect(() => {
    if (!useSlides) return;
    setMemo(pickOnOpen(images.length, slideshow.intervalMinutes, slideshow.shuffle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useSlides, images.length, slideshow.intervalMinutes, slideshow.shuffle]);

  // 開いたままにしているあいだも、間隔ごとに次の画像へ進める
  useEffect(() => {
    if (!useSlides || !memo || slideshow.intervalMinutes === 0 || images.length <= 1) return;
    const wait = Math.max(1000, memo.changedAt + slideshow.intervalMinutes * 60_000 - Date.now());
    const timer = setTimeout(() => {
      setPrevious(images[memo.index] ?? null);
      const next = { index: nextIndex(memo.index, images.length, slideshow.shuffle), changedAt: Date.now() };
      writeMemo(next);
      setMemo(next);
    }, wait);
    return () => clearTimeout(timer);
  }, [useSlides, memo, images, slideshow.intervalMinutes, slideshow.shuffle]);

  const src = useSlides ? (memo ? images[memo.index] : undefined) : image.src;
  if (!src) return null;

  return (
    <>
      {previous && previous !== src && <div aria-hidden className={styles.layer} style={{ backgroundImage: `url("${previous}")` }} />}
      <div
        aria-hidden
        // key を変えて要素ごと作り直すことで、切り替わるたびにフェードインのアニメーションを最初から流す
        key={src.length > 64 ? `${src.length}:${src.slice(-64)}` : src}
        className={styles.layer}
        style={{ backgroundImage: `url("${src}")`, animationName: useSlides ? undefined : 'none' }}
        onAnimationEnd={() => setPrevious(null)}
      />
    </>
  );
}
