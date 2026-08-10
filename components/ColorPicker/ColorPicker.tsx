import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cx } from '@/lib/cx';
import { hexToHsv, hsvToHex, isValidHex, normalizeHex, type HSV } from '@/lib/color';

import styles from './color-picker.module.css';

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  id?: string;
}

/** よく使う色のショートカット。テーマの既定色と相性の良い並びにしている。 */
const SWATCHES = [
  '#ffffff', '#f1ecec', '#0c0d14', '#11141b',
  '#ff8a4c', '#ffb020', '#6ee7b7', '#6aa9ff',
  '#c084fc', '#ff6b81',
];

/**
 * ネイティブ `<input type="color">` の置き換え。
 *
 * OS標準のカラーピッカー（Windowsのそれは特に古めかしい）を出さず、
 * 彩度・明度パネル＋色相バー＋HEX入力を自前で持つポップオーバーにしている。
 */
export function ColorPicker({ value, onChange, id }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(() => normalizeHex(value));
  const [draftHex, setDraftHex] = useState(hex);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<'sv' | 'hue' | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const normalized = normalizeHex(value);
    setHex(normalized);
    setDraftHex(normalized);
  }, [value]);

  const hsv = hexToHsv(hex);

  const commit = (next: HSV): void => {
    const nextHex = hsvToHex(next);
    setHex(nextHex);
    setDraftHex(nextHex);
    onChange(nextHex);
  };

  const updateFromSvPointer = (clientX: number, clientY: number): void => {
    const rect = svRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const v = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    commit({ ...hsv, s, v });
  };

  const updateFromHuePointer = (clientX: number): void => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const h = Math.min(360, Math.max(0, ((clientX - rect.left) / rect.width) * 360));
    commit({ ...hsv, h });
  };

  // トリガー（スワッチボタン）の位置に合わせてポップオーバーを fixed 配置する。
  //
  // 以前は position: absolute で .root の直下に描画していたため、SidePanel の
  // スクロール領域（overflow-y: auto）の下の方でスワッチを開くと、彩度・明度パネルや
  // 色相バーがそのスクロール境界の外側に出てしまい、見えない・操作できない状態に
  // なっていた（.root はスクロールに追従して動くだけで、はみ出た分は普通に切れる）。
  // Dropdown / AddWithPresets と同じ考え方で document.body へポータルし、
  // ビューポート基準の座標で毎回配置し直すことでこれを避けている。
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const popoverHeight = 300; // svPanel + hueBar + swatchRow + padding のおおよその高さ
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < popoverHeight && rect.top > spaceBelow;

    setPopoverStyle({
      position: 'fixed',
      left: rect.left,
      width: 220,
      ...(openUpward ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onMove = (e: PointerEvent): void => {
      if (draggingRef.current === 'sv') updateFromSvPointer(e.clientX, e.clientY);
      else if (draggingRef.current === 'hue') updateFromHuePointer(e.clientX);
    };
    const onUp = (): void => {
      draggingRef.current = null;
    };
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = (e: Event): void => {
      // ポップオーバー自体には内部スクロールが無いが、念のため Dropdown と同様に
      // 対象がポップオーバー内かどうかで判定しておく（外側のスクロールでのみ閉じる）。
      const target = e.target;
      if (target instanceof Node && popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hsv.h, hsv.s, hsv.v]);

  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        id={id}
        type="button"
        className={styles.swatchButton}
        style={{ background: hex }}
        aria-label="色を選択"
        onClick={() => setOpen((v) => !v)}
      />
      <input
        type="text"
        className={styles.hexField}
        value={draftHex}
        onChange={(e) => {
          setDraftHex(e.target.value);
          if (isValidHex(e.target.value)) {
            const normalized = normalizeHex(e.target.value);
            setHex(normalized);
            onChange(normalized);
          }
        }}
        onBlur={() => setDraftHex(hex)}
        spellCheck={false}
      />

      {open &&
        createPortal(
          <div ref={popoverRef} className={styles.popover} style={popoverStyle}>
            <div
              ref={svRef}
              className={styles.svPanel}
              style={{ backgroundColor: hueColor }}
              onPointerDown={(e) => {
                draggingRef.current = 'sv';
                updateFromSvPointer(e.clientX, e.clientY);
              }}
            >
              <div className={styles.svWhite} />
              <div className={styles.svBlack} />
              <div
                className={styles.svThumb}
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
              />
            </div>

            <div
              ref={hueRef}
              className={styles.hueBar}
              onPointerDown={(e) => {
                draggingRef.current = 'hue';
                updateFromHuePointer(e.clientX);
              }}
            >
              <div className={styles.hueThumb} style={{ left: `${(hsv.h / 360) * 100}%` }} />
            </div>

            <div className={styles.swatchRow}>
              {SWATCHES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={cx(styles.swatch, s.toLowerCase() === hex && styles.swatchActive)}
                  style={{ background: s }}
                  aria-label={s}
                  onClick={() => {
                    setHex(s);
                    setDraftHex(s);
                    onChange(s);
                  }}
                />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
