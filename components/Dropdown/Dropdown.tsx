import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

import { cx } from '@/lib/cx';

import styles from './dropdown.module.css';

export interface DropdownOption {
  value: string;
  label: string;
  /** オプション自体に当てるインラインスタイル（フォントのプレビュー等に使う） */
  style?: React.CSSProperties;
}

interface DropdownProps {
  value: string;
  options: ReadonlyArray<DropdownOption>;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}

/**
 * ネイティブ `<select>` の置き換え。
 *
 * ブラウザ既定のドロップダウンはOSごとに見た目がバラバラでテーマに合わせられないため、
 * 独自に描画している。キーボード操作（↑↓ Enter Escape）とフォーカスリングは
 * ネイティブ select と同等になるよう実装している。
 */
export function Dropdown({ value, options, onChange, id, disabled }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

  // トリガーの位置に合わせてメニューを fixed 配置する。
  // SidePanel はスクロール領域（overflow-y: auto）を持つため、absolute だと
  // スクロール時にクリップされてしまう。fixed + 開いた瞬間の座標計算で回避する。
  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 240 && rect.top > spaceBelow;

    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(openUpward ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setHighlight(selectedIndex);

    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      // トリガー本体、あるいはポータルで body 直下に出しているメニュー自身へのクリックは無視する
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = (e: Event): void => {
      // メニュー自体（選択肢が多くて overflow-y: auto になっている場合）の内部スクロールは
      // 無視する。capture フェーズで window に張っているため、対象を問わず
      // ページ内のあらゆるスクロールを拾ってしまい、メニュー内をスクロールしようとした
      // だけで閉じてしまっていた。閉じるべきなのは「メニューの外側」がスクロールして
      // 基準位置がずれたときだけ。
      const target = e.target;
      if (target instanceof Node && listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        rootRef.current?.querySelector('button')?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, selectedIndex]);

  const commit = (index: number): void => {
    const option = options[index];
    if (option) onChange(option.value);
    setOpen(false);
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent): void => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(options.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commit(highlight);
    }
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        id={id}
        type="button"
        className={styles.trigger}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className={styles.triggerLabel} style={selected?.style}>
          {selected?.label ?? ''}
        </span>
        <ChevronDown size={15} className={cx(styles.chevron, open && styles.chevronOpen)} />
      </button>

      {open &&
        createPortal(
          // SidePanel は backdrop-filter を持ち、CSS の仕様上それが
          // position: fixed な子孫の containing block になってしまう
          // （fixed が「ビューポート基準」ではなく「そのパネル基準」になる）。
          // そのため、開いたメニューが画面外に飛んで見えなくなっていた。
          // document.body 直下へポータルで描画し、常にビューポート基準にする。
          <ul
            className={styles.menu}
            role="listbox"
            style={menuStyle}
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
            ref={(el) => {
              listRef.current = el;
              // 開いた瞬間にリストへフォーカスし、矢印キーで即座に操作できるようにする。
              //
              // このコールバック ref は useLayoutEffect で menuStyle（fixed の座標）を
              // 確定させるより前に実行される。つまり初回オープン時はメニューがまだ
              // 正しい位置に配置される前の状態で focus() が呼ばれることになり、
              // ブラウザの「フォーカスした要素を自動で画面内へスクロールする」機能が
              // 発火してしまっていた。そのスクロールを自分自身の onScroll ハンドラが
              // 「ユーザーがスクロールした＝閉じる」と誤認し、開いた直後に閉じる
              // （初回クリックだけ一瞬表示して消える）不具合になっていた。
              // preventScroll でこの自動スクロールそのものを止める。
              el?.focus({ preventScroll: true });
            }}
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={cx(
                  styles.option,
                  index === highlight && styles.optionHighlighted,
                  option.value === value && styles.optionSelected,
                )}
                style={option.style}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => commit(index)}
              >
                <span className={styles.optionLabel}>{option.label}</span>
                {option.value === value && <Check size={14} className={styles.checkIcon} />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
