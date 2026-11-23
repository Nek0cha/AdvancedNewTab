import { forwardRef, useCallback, useState, type HTMLAttributes, type MouseEvent as ReactMouseEvent } from 'react';
import { AlignHorizontalJustifyCenter, Copy, GripVertical, Lock, LockOpen, Settings2, TriangleAlert, X } from 'lucide-react';

import { useT } from '@/lib/i18n';
import { useGridStatus } from '@/components/Grid/GridStatusContext';
import { cx } from '@/lib/cx';
import { useAppStore } from '@/lib/store';
import { getWidgetBackgroundStyle, type WidgetBackgroundSettings } from '@/lib/widget-background';
import { isWidgetStyleCustomized } from '@/lib/widget-style-code';
import { getWidgetTextStyle, type WidgetTextSettings } from '@/lib/widget-style';
import { getWidgetDef } from '@/widgets/registry';

import { WidgetErrorBoundary } from './ErrorBoundary';
import { WidgetContextMenu } from './WidgetContextMenu';
import styles from './widget-frame.module.css';

interface WidgetFrameProps extends HTMLAttributes<HTMLDivElement> {
  instanceId: string;
  /** lib/grid-collision.ts の findOverlappingIds で「誰かと重なっている」と判定されたか */
  overlapping?: boolean;
}

/**
 * グリッドに置かれるウィジェット1個の外枠。
 *
 * react-grid-layout は子要素を cloneElement して ref / className / style / マウスイベントを
 * 注入する方式のため、このコンポーネントは forwardRef で ref を実DOMへ渡し、
 * 受け取った props をルート要素にそのまま展開する必要がある。
 * （ここを怠るとドラッグもリサイズも動かない）
 */
export const WidgetFrame = forwardRef<HTMLDivElement, WidgetFrameProps>(function WidgetFrame(
  { instanceId, className, children, overlapping, style: gridStyle, ...rest },
  ref,
) {
  const editMode = useAppStore((s) => s.editMode);
  const instance = useAppStore((s) => s.state.widgets[instanceId]);
  const theme = useAppStore((s) => s.state.theme);
  const removeWidget = useAppStore((s) => s.removeWidget);
  const duplicateWidget = useAppStore((s) => s.duplicateWidget);
  const openPanel = useAppStore((s) => s.openPanel);
  const centerWidgetHorizontally = useAppStore((s) => s.centerWidgetHorizontally);
  const patchWidgetSettings = useAppStore((s) => s.patchWidgetSettings);
  const t = useT();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  // リンク・入力欄・選択中のテキストの上では、ブラウザ標準のメニュー（新しいタブで開く、
  // コピー/貼り付けなど）の方が必要とされるため、独自メニューを出さずに譲る。
  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>): void => {
    const target = e.target as Element;
    if (target.closest('a, input, textarea, select, [contenteditable="true"]')) return;
    if ((window.getSelection()?.toString() ?? '') !== '') return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const def = instance ? getWidgetDef(instance.type) : undefined;
  const frameKind = def?.frame ?? 'card';

  // 設定の欠けは既定値で埋める。ウィジェットに設定項目を追加しても、
  // 既存ユーザーのデータをマイグレーションせずに済む。
  const settings = def ? { ...def.defaultSettings, ...(instance?.settings ?? {}) } : {};
  const Icon = def?.icon;

  // ウィンドウリサイズ中・狭い画面幅のときに時計・検索以外を一時的に隠す
  // （widgets/registry.ts が注入する hideOnResize 設定。既定は clock/search だけ false）。
  // 編集モード中は隠すと配置操作の邪魔になるため対象外にする。
  const { isResizing, isNarrow } = useGridStatus();
  const shouldHideOnResize = !editMode && settings.hideOnResize === true && (isResizing || isNarrow);

  // ロック中は外枠ごと react-grid-layout のドラッグ対象から外す（dragConfig.cancel は
  // 押した要素からウィジェット外枠自身までさかのぼって判定するため、外枠に付ければ全体に効く）。
  // リサイズの取っ手は .locked 側の CSS で隠す。レイアウトのデータには手を入れないので、
  // Grid.tsx の繊細な回避策（CLAUDE.md の Grid 節）には影響しない。
  const locked = settings.locked === true;

  const rootClassName = cx(
    className,
    locked && 'ant-no-drag',
    locked && styles.locked,
    styles.frame,
    frameKind === 'bare' ? styles.bare : styles.card,
    editMode && styles.editing,
    editMode && overlapping && styles.overlapping,
    shouldHideOnResize && styles.resizeHidden,
  );

  // 個別スタイルは backgroundScope:'self'（検索など）を宣言したウィジェットだけ、
  // Component が自前で適用する。それ以外は widgets/registry.ts が全ウィジェットへ
  // 自動注入した設定を、ここで外枠（.card/.bare）へ一括適用する。
  const backgroundStyle =
    def && def.backgroundScope !== 'self'
      ? getWidgetBackgroundStyle(settings as WidgetBackgroundSettings)
      : undefined;

  // 文字色・アクセントカラー・太さの個別設定（未指定なら undefined で何も上書きしない）。
  // CSSカスタムプロパティとして .frame へ注入するだけで、各ウィジェットの .module.css は
  // 変更不要（すべて var(--ant-text)/var(--ant-accent)/var(--ant-muted) を参照しているため、
  // 継承でウィジェット内部全体へ自動的に伝播する。編集モードの帯は --ant-chrome-text 系の
  // 固定トークンを使っているため、ここで上書きしても影響を受けない）。
  const textStyle = getWidgetTextStyle(settings as WidgetTextSettings, theme);

  // 個別スタイル（背景・文字色・アクセント・サブアクセント・太さ）のどれかを
  // 「個別に指定」しているかどうか。設定ボタンに気づきやすいバッジを出す判定に使う。
  const isCustomized = isWidgetStyleCustomized(settings);

  return (
    <div ref={ref} className={rootClassName} style={{ ...gridStyle, ...backgroundStyle, ...textStyle }} {...rest} onContextMenu={instance ? handleContextMenu : undefined}>
      {editMode && overlapping && (
        <span className={styles.overlapWarning} title={t('他のウィジェットと重なっています')}>
          <TriangleAlert size={13} />
        </span>
      )}

      {editMode && (
        <div className={styles.header}>
          {locked ? (
            <Lock size={14} className={styles.gripIcon} aria-hidden />
          ) : (
            <GripVertical size={14} className={styles.gripIcon} aria-hidden />
          )}
          {Icon && <Icon size={14} className={styles.titleIcon} aria-hidden />}
          <span className={styles.title}>{def ? t(def.name) : t('不明なウィジェット')}</span>
          <button
            type="button"
            className={cx(styles.headerButton, 'ant-no-drag')}
            title={t('水平方向の中央に配置')}
            onClick={() => centerWidgetHorizontally(instanceId)}
          >
            <AlignHorizontalJustifyCenter size={14} />
          </button>
          {def && def.settingsSchema.length > 0 && (
            <button
              type="button"
              className={cx(styles.headerButton, 'ant-no-drag')}
              title={isCustomized ? t('{name} の設定（個別スタイルを使用中）', { name: t(def.name) }) : t('{name} の設定', { name: t(def.name) })}
              onClick={() => openPanel({ kind: 'widget', instanceId })}
            >
              <Settings2 size={14} />
              {isCustomized && <span className={styles.customBadge} aria-hidden />}
            </button>
          )}
          <button
            type="button"
            className={cx(styles.headerButton, 'ant-no-drag', locked && styles.headerButtonActive)}
            title={locked ? t('固定を解除') : t('位置とサイズを固定する')}
            aria-pressed={locked}
            onClick={() => patchWidgetSettings(instanceId, { locked: !locked })}
          >
            {locked ? <Lock size={14} /> : <LockOpen size={14} />}
          </button>
          <button
            type="button"
            className={cx(styles.headerButton, 'ant-no-drag')}
            title={t('このウィジェットを複製')}
            onClick={() => duplicateWidget(instanceId)}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className={cx(styles.headerButton, styles.danger, 'ant-no-drag')}
            title={t('このウィジェットを削除')}
            onClick={() => removeWidget(instanceId)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className={cx(styles.body, editMode && styles.bodyLocked)}>
        {def && instance ? (
          <WidgetErrorBoundary label={def.name}>
            <def.Component settings={settings} instanceId={instanceId} editMode={editMode} />
          </WidgetErrorBoundary>
        ) : (
          <div className={styles.unknown}>
            <TriangleAlert size={16} />
            <span>
              {t('種類「{type}」のウィジェットは見つかりませんでした。 拡張機能のバージョンを戻した場合などに起こります。編集モードで削除できます。', { type: instance?.type ?? t('不明') })}
            </span>
          </div>
        )}
      </div>

      {children}
      {menu && (
        <WidgetContextMenu
          instanceId={instanceId}
          x={menu.x}
          y={menu.y}
          hasSettings={(def?.settingsSchema.length ?? 0) > 0}
          locked={locked}
          onClose={closeMenu}
        />
      )}
    </div>
  );
});
