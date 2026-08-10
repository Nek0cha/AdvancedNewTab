import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';

import { svgToDataUrl, tintSvgCode } from '@/lib/icon-value';
import { useAppStore } from '@/lib/store';
import type { ListPreset } from '@/widgets/types';

import styles from './field.module.css';
import popoverStyles from './add-with-presets.module.css';

interface AddWithPresetsProps {
  addLabel: string;
  presets: ReadonlyArray<ListPreset>;
  onAddBlank: () => void;
  onAddPreset: (preset: ListPreset) => void;
}

/**
 * リストの「追加」ボタン。プリセットが指定されている場合は、
 * 「空の項目を追加」とプリセット一覧を出すポップオーバーに変わる。
 *
 * 位置決めと外側クリックでの自動クローズは components/Dropdown/Dropdown.tsx と
 * 同じ考え方（document.body へのポータル描画＋fixed配置）。SidePanel の
 * backdrop-filter が position:fixed の基準点をパネル自身に変えてしまうため、
 * ポータルを使わないとメニューが画面外に飛んでしまう（Dropdown参照）。
 */
export function AddWithPresets({ addLabel, presets, onAddBlank, onAddPreset }: AddWithPresetsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  // プリセットのSVGは fill="currentColor" 前提（lib/icon-value.ts の tintSvgCode 参照）。
  // <img> 描画では currentColor がページCSSを継承できず既定の黒になるため、
  // ダークモードのメニュー背景（--ant-menu-bg）では真っ黒＝見えない状態になっていた。
  // ライトモードの背景では黒のままでちょうど良いので、ダークモードのときだけ明るい色を重ねる。
  const themeMode = useAppStore((s) => s.state.theme.mode);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 320 && rect.top > spaceBelow;

    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(320, openUpward ? rect.top - 16 : spaceBelow - 16),
      ...(openUpward ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = (e: Event): void => {
      // メニュー内部（プリセット一覧は overflow-y: auto）のスクロールでは閉じない。
      // capture で window に張っているため対象を問わず拾ってしまい、一覧を
      // スクロールしようとしただけで閉じてしまっていた（Dropdown.tsx と同種の不具合）。
      const target = e.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={popoverStyles.root}>
      <button type="button" className={styles.addButton} onClick={() => setOpen((v) => !v)}>
        <Plus size={14} /> {addLabel}
      </button>

      {open &&
        createPortal(
          <div ref={menuRef} className={popoverStyles.menu} style={menuStyle}>
            <button
              type="button"
              className={popoverStyles.item}
              onClick={() => {
                onAddBlank();
                setOpen(false);
              }}
            >
              <span className={popoverStyles.blankIcon} aria-hidden />
              <span>空の項目を追加</span>
            </button>

            <div className={popoverStyles.divider} />

            <div className={popoverStyles.presetList}>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={popoverStyles.item}
                  onClick={() => {
                    onAddPreset(preset);
                    setOpen(false);
                  }}
                >
                  {preset.iconSvg ? (
                    <img
                      className={popoverStyles.presetIcon}
                      src={svgToDataUrl(
                        themeMode === 'dark' ? tintSvgCode(preset.iconSvg, '#f1ecec') : preset.iconSvg,
                      )}
                      alt=""
                    />
                  ) : (
                    <span className={popoverStyles.blankIcon} aria-hidden />
                  )}
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
