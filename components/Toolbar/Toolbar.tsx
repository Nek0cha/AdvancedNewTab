import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, GripVertical, Palette, Pencil, Plus } from 'lucide-react';

import { cx } from '@/lib/cx';
import { useAppStore } from '@/lib/store';

import styles from './toolbar.module.css';

interface DragOrigin {
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
}

/**
 * 画面右上の操作パネル。
 *
 * 新規タブは「見る」ための画面なので、通常時は薄く沈ませておき、
 * カーソルが近づいたときとフォーカスが当たったときだけ立ち上がるようにしている。
 *
 * 編集モード中、右上に置いたウィジェット自身の編集用ヘッダー（WidgetFrame の帯）と
 * ちょうど重なって操作しづらくなることがある。以前はグリッド全体の幅を縮めて
 * ツールバー専用の空きを作る方式を試したが、「何が起きているか分かりにくい」という
 * フィードバックで撤回した。代わりに、ツールバー自体をドラッグでどこへでも
 * 動かせるようにし、位置を PersistedState.toolbarPosition に保存している
 * （グリップをダブルクリックすると既定位置＝右上へ戻る）。
 *
 * サイドパネル（設定/追加）が開いているときに自分の位置を左へずらす挙動は、
 * ツールバーが「既定位置（未移動）」のときだけ有効にしている。ユーザーが
 * 既に好きな場所へ動かしている場合は、その位置を尊重して自動シフトしない。
 */
export function Toolbar() {
  const editMode = useAppStore((s) => s.editMode);
  const setEditMode = useAppStore((s) => s.setEditMode);
  const panel = useAppStore((s) => s.panel);
  const openPanel = useAppStore((s) => s.openPanel);
  const toolbarPosition = useAppStore((s) => s.state.toolbarPosition);
  const setToolbarPosition = useAppStore((s) => s.setToolbarPosition);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const dragOriginRef = useRef<DragOrigin | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;

    const clamp = (left: number, top: number): { left: number; top: number } => {
      const el = toolbarRef.current;
      const rect = el?.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - (rect?.width ?? 0));
      const maxTop = Math.max(0, window.innerHeight - (rect?.height ?? 0));
      return { left: Math.min(Math.max(0, left), maxLeft), top: Math.min(Math.max(0, top), maxTop) };
    };

    const onMove = (e: PointerEvent): void => {
      const origin = dragOriginRef.current;
      const el = toolbarRef.current;
      if (!origin || !el) return;
      const { left, top } = clamp(origin.originLeft + (e.clientX - origin.startX), origin.originTop + (e.clientY - origin.startY));
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.right = 'auto';
    };

    const onUp = (e: PointerEvent): void => {
      const origin = dragOriginRef.current;
      if (origin) {
        const { left, top } = clamp(origin.originLeft + (e.clientX - origin.startX), origin.originTop + (e.clientY - origin.startY));
        setToolbarPosition({ x: left, y: top });
      }
      dragOriginRef.current = null;
      setDragging(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, setToolbarPosition]);

  const handleGripPointerDown = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    const el = toolbarRef.current;
    if (!el) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    dragOriginRef.current = { startX: e.clientX, startY: e.clientY, originLeft: rect.left, originTop: rect.top };
    setDragging(true);
  };

  const positionStyle: CSSProperties | undefined = toolbarPosition
    ? { left: toolbarPosition.x, top: toolbarPosition.y, right: 'auto' }
    : undefined;

  return (
    <div
      ref={toolbarRef}
      className={cx(
        styles.toolbar,
        editMode && styles.editing,
        panel && !toolbarPosition && styles.panelOpen,
        dragging && styles.dragging,
      )}
      style={positionStyle}
    >
      <button
        type="button"
        className={cx(styles.grip, 'ant-no-drag')}
        title="ドラッグで移動（ダブルクリックで既定位置に戻す）"
        onPointerDown={handleGripPointerDown}
        onDoubleClick={() => setToolbarPosition(null)}
      >
        <GripVertical size={14} />
      </button>

      {editMode && (
        <>
          <button
            type="button"
            className={styles.button}
            onClick={() => openPanel({ kind: 'add' })}
          >
            <Plus size={15} />
            ウィジェット
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => openPanel({ kind: 'theme' })}
          >
            <Palette size={15} />
            見た目
          </button>
        </>
      )}
      <button
        type="button"
        className={cx(styles.button, editMode && styles.primary)}
        onClick={() => setEditMode(!editMode)}
        title={editMode ? '編集を終了する' : 'レイアウトを編集する'}
      >
        {editMode ? <Check size={15} /> : <Pencil size={15} />}
        {editMode ? '完了' : '編集'}
      </button>
    </div>
  );
}
