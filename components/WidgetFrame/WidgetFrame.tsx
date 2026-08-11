import { forwardRef, type HTMLAttributes } from 'react';
import { AlignHorizontalJustifyCenter, Copy, GripVertical, Settings2, TriangleAlert, X } from 'lucide-react';

import { useGridStatus } from '@/components/Grid/GridStatusContext';
import { cx } from '@/lib/cx';
import { useAppStore } from '@/lib/store';
import { getWidgetBackgroundStyle, type WidgetBackgroundSettings } from '@/lib/widget-background';
import { isWidgetStyleCustomized } from '@/lib/widget-style-code';
import { getWidgetTextStyle, type WidgetTextSettings } from '@/lib/widget-style';
import { getWidgetDef } from '@/widgets/registry';

import { WidgetErrorBoundary } from './ErrorBoundary';
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

  const rootClassName = cx(
    className,
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
    <div ref={ref} className={rootClassName} style={{ ...gridStyle, ...backgroundStyle, ...textStyle }} {...rest}>
      {editMode && overlapping && (
        <span className={styles.overlapWarning} title="他のウィジェットと重なっています">
          <TriangleAlert size={13} />
        </span>
      )}

      {editMode && (
        <div className={styles.header}>
          <GripVertical size={14} className={styles.gripIcon} aria-hidden />
          {Icon && <Icon size={14} className={styles.titleIcon} aria-hidden />}
          <span className={styles.title}>{def ? def.name : '不明なウィジェット'}</span>
          <button
            type="button"
            className={cx(styles.headerButton, 'ant-no-drag')}
            title="水平方向の中央に配置"
            onClick={() => centerWidgetHorizontally(instanceId)}
          >
            <AlignHorizontalJustifyCenter size={14} />
          </button>
          {def && def.settingsSchema.length > 0 && (
            <button
              type="button"
              className={cx(styles.headerButton, 'ant-no-drag')}
              title={isCustomized ? `${def.name} の設定（個別スタイルを使用中）` : `${def.name} の設定`}
              onClick={() => openPanel({ kind: 'widget', instanceId })}
            >
              <Settings2 size={14} />
              {isCustomized && <span className={styles.customBadge} aria-hidden />}
            </button>
          )}
          <button
            type="button"
            className={cx(styles.headerButton, 'ant-no-drag')}
            title="このウィジェットを複製"
            onClick={() => duplicateWidget(instanceId)}
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            className={cx(styles.headerButton, styles.danger, 'ant-no-drag')}
            title="このウィジェットを削除"
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
              種類「{instance?.type ?? '不明'}」のウィジェットは見つかりませんでした。
              拡張機能のバージョンを戻した場合などに起こります。編集モードで削除できます。
            </span>
          </div>
        )}
      </div>

      {children}
    </div>
  );
});
