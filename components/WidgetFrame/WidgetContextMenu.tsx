import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Pencil, Settings2, Trash2 } from 'lucide-react';

import { cx } from '@/lib/cx';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';

import styles from './widget-context-menu.module.css';

interface WidgetContextMenuProps {
  instanceId: string;
  /** 右クリックした位置（ビューポート座標） */
  x: number;
  y: number;
  hasSettings: boolean;
  onClose: () => void;
}

/** ビューポート端からの最小の余白 */
const EDGE = 8;

/**
 * ウィジェットの右クリックメニュー。
 * 以前は設定を開くのに「ツールバーの編集 → ウィジェットの帯の歯車」の2段階が必要で、
 * 編集モードの存在に気づかないと設定にたどり着けなかった。通常表示のままでも
 * 設定・複製・削除へ直接行けるようにしている。
 *
 * SidePanel の backdrop-filter が position: fixed の基準を奪う問題（Dropdown.tsx 参照）は
 * ここでは起きないが、ウィジェットの枠にも backdrop-filter が掛かるため、
 * 同じ理由で document.body へポータルしている。
 */
export function WidgetContextMenu({ instanceId, x, y, hasSettings, onClose }: WidgetContextMenuProps) {
  const t = useT();
  const openPanel = useAppStore((s) => s.openPanel);
  const duplicateWidget = useAppStore((s) => s.duplicateWidget);
  const removeWidget = useAppStore((s) => s.removeWidget);
  const editMode = useAppStore((s) => s.editMode);
  const setEditMode = useAppStore((s) => s.setEditMode);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  // 通常表示ではUndoのボタンもショートカットも無いため、削除だけは
  // 「もう一度押して確定」の2段階にして誤操作で消えないようにする。
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 画面端で見切れないよう、実寸を測ってから内側へ押し戻す
  useLayoutEffect(() => {
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      left: Math.max(EDGE, Math.min(x, window.innerWidth - rect.width - EDGE)),
      top: Math.max(EDGE, Math.min(y, window.innerHeight - rect.height - EDGE)),
    });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent): void => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    // メニュー自身のスクロールでは閉じない（Dropdown と同じ扱い）
    const onScroll = (e: Event): void => {
      if (!menuRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className={styles.menu}
      style={{ left: pos.left, top: pos.top }}
      // ポータル先は DOM 上は body 直下でも、React のイベントはコンポーネントツリーを
      // 遡って WidgetFrame まで届く。そこには react-grid-layout のドラッグ開始処理と
      // 右クリックの処理が付いているため、メニュー内の操作はここで止める。
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {hasSettings && (
        <button type="button" role="menuitem" className={styles.item} onClick={run(() => openPanel({ kind: 'widget', instanceId }))}>
          <Settings2 size={14} />
          {t('設定')}
        </button>
      )}
      <button type="button" role="menuitem" className={styles.item} onClick={run(() => duplicateWidget(instanceId))}>
        <Copy size={14} />
        {t('複製')}
      </button>
      {!editMode && (
        <button type="button" role="menuitem" className={styles.item} onClick={run(() => setEditMode(true))}>
          <Pencil size={14} />
          {t('レイアウトを編集')}
        </button>
      )}
      <div className={styles.separator} />
      <button
        type="button"
        role="menuitem"
        className={cx(styles.item, styles.danger, confirmDelete && styles.confirm)}
        onClick={confirmDelete ? run(() => removeWidget(instanceId)) : () => setConfirmDelete(true)}
      >
        <Trash2 size={14} />
        {confirmDelete ? t('もう一度押して削除') : t('削除')}
      </button>
    </div>,
    document.body,
  );
}
