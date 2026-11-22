import type { CSSProperties } from 'react';
import { Link2 } from 'lucide-react';

import { IconValueDisplay } from '@/components/IconValueDisplay/IconValueDisplay';
import { cx } from '@/lib/cx';
import { faviconUrl } from '@/lib/favicon';
import { normalizeIconValue } from '@/lib/icon-value';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { LINK_PRESETS } from '@/lib/link-presets';
import { defineWidget, type ListPreset, type WidgetProps } from '@/widgets/types';

import styles from './links.module.css';

interface LinkItem extends Record<string, unknown> {
  label: string;
  url: string;
  /** 未設定なら favicon を自動表示する（widgets/types.ts の kind:'icon' 参照） */
  icon?: unknown;
}

interface LinksSettings extends Record<string, unknown> {
  items: LinkItem[];
  /** クリック時に現在のタブを差し替えるか、新しいタブで開くか */
  openInNewTab: boolean;
  /**
   * SVGアイコン（アイコン設定で「SVG」を選んだもの）全体に一括で適用する色。
   * アイコンごとではなく、このウィジェット内のSVGアイコンすべてに反映される。
   * lucide/画像/URLアイコンには影響しない（IconValueDisplay の svgTint 参照）。
   */
  svgIconColor: string;
  /**
   * 'auto' はテーマ（またはウィジェット個別）の文字色に合わせる。以前は既定色が
   * 白系の固定値だったため、明るいテーマに切り替えるとアイコンが背景に溶けて見えなくなっていた。
   */
  svgIconColorMode: 'auto' | 'custom';
  /** アイコンの大きさ */
  iconSize: 'small' | 'medium' | 'large';
  /** アイコンの下にリンク名を出すか */
  showLabels: boolean;
  /** 1行に並べる数。0 は幅に合わせて自動で折り返す */
  columns: number;
  /** ウィジェット幅に対してリンクの並びをどこに寄せるか */
  alignment: 'left' | 'center' | 'right';
}

const ALIGNMENT_TO_JUSTIFY_CONTENT: Record<LinksSettings['alignment'], string> = {
  left: 'flex-start',
  center: 'center',
  right: 'flex-end',
};

/** lib/link-presets.ts のプリセットを、リストの追加ポップオーバーが扱える形に変換する。 */
const LINK_ADD_PRESETS: ListPreset[] = LINK_PRESETS.map((preset) => ({
  id: preset.id,
  label: preset.name,
  iconSvg: preset.icon.source === 'svg' ? preset.icon.code : undefined,
  value: { label: preset.name, url: preset.url, icon: preset.icon } satisfies LinkItem,
}));

/** ユーザー入力の URL を実際に開ける形に補う。プロトコル省略時は https を仮定する。 */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return null;
    }
  }
}

/**
 * アイコンの大きさごとの寸法（px）。links.module.css は CSS 変数の既定値として「中」と同じ値を
 * 持っているため、同じ CSS を流用している topsites / bookmarks の見た目は変わらない。
 */
const ICON_SIZES = {
  small: { icon: 16, wrap: 30, item: 56 },
  medium: { icon: 20, wrap: 36, item: 64 },
  large: { icon: 26, wrap: 46, item: 78 },
} as const;

function LinksWidget({ settings, editMode }: WidgetProps<LinksSettings>) {
  const t = useT();
  const themeTextColor = useAppStore((s) => s.state.theme.textColor);
  const items = settings.items.filter((item) => normalizeUrl(item.url));
  // SVGは <img> 経由で描画するため CSS の currentColor が届かない（lib/icon-value.ts 参照）。
  // 「自動」のときは、ウィジェット個別の文字色 → テーマの文字色の順で実際の色を焼き込む。
  const extra = settings as unknown as Record<string, unknown>;
  const svgTint =
    settings.svgIconColorMode === 'custom'
      ? settings.svgIconColor
      : extra.textMode === 'custom' && typeof extra.textColor === 'string'
        ? extra.textColor
        : themeTextColor;
  const size = ICON_SIZES[settings.iconSize] ?? ICON_SIZES.medium;

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        {t('リンクが登録されていません。編集モードでウィジェットの設定からリンクを追加してください。')}
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div
        className={cx(styles.grid, !settings.showLabels && styles.noLabels)}
        style={{
          justifyContent: ALIGNMENT_TO_JUSTIFY_CONTENT[settings.alignment],
          '--link-icon': `${size.icon}px`,
          '--link-wrap': `${size.wrap}px`,
          '--link-item': `${size.item}px`,
          // 列数指定時だけ grid に切り替える。flex の折り返しでは「ちょうどN個で改行」を保証できないため
          ...(settings.columns > 0
            ? { display: 'grid', gridTemplateColumns: `repeat(${settings.columns}, var(--link-item))` }
            : {}),
        } as CSSProperties}
      >
        {items.map((item, index) => {
          const url = normalizeUrl(item.url);
          if (!url) return null;
          return (
            <a
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className={styles.item}
              href={url}
              // 長いリンク名は .label 側のCSSで省略表示（ellipsis）されるため、
              // ホバーで正式な表示名全文を見られるようにしておく。
              title={item.label || new URL(url).hostname}
              target={settings.openInNewTab ? '_blank' : undefined}
              rel={settings.openInNewTab ? 'noopener noreferrer' : undefined}
              // 編集モード中はドラッグを優先し、誤クリックでの遷移を防ぐ
              onClick={(e) => {
                if (editMode) e.preventDefault();
              }}
            >
              <span className={styles.iconWrap}>
                <IconValueDisplay
                  value={normalizeIconValue(item.icon)}
                  fallback={<img className={styles.icon} src={faviconUrl(url)} alt="" />}
                  size={size.icon}
                  className={styles.icon}
                  svgTint={svgTint || undefined}
                />
              </span>
              <span className={styles.label}>{item.label || new URL(url).hostname}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export const linksWidget = defineWidget<LinksSettings>({
  type: 'links',
  category: 'links',
  name: 'リンク集',
  description: 'よく使うサイトへのリンクをアイコン付きで並べます。',
  icon: Link2,
  // minH: 1（他の1行系ウィジェットと同じ最小値）。アイコン1段分の高さに収まるので、
  // 「もう一段狭くしたい」に応えて、ここまで縮められるようにしている。
  defaultLayout: { w: 4, h: 3, minW: 2, minH: 1 },
  // favicon は wxt.config.ts で必須権限として宣言済み（インストール時に自動付与される）。
  // optional_permissions に無い権限を chrome.permissions.request() へ渡すとエラーになるため、
  // ここでは宣言しない。
  defaultSettings: {
    items: [
      { label: 'Gmail', url: 'https://mail.google.com/' },
      { label: 'カレンダー', url: 'https://calendar.google.com/' },
      { label: 'YouTube', url: 'https://www.youtube.com/' },
    ],
    openInNewTab: false,
    svgIconColor: '#f1ecec',
    svgIconColorMode: 'auto',
    iconSize: 'medium',
    showLabels: true,
    columns: 0,
    alignment: 'center',
  },
  settingsSchema: [
    {
      kind: 'list',
      key: 'items',
      label: 'リンク一覧',
      addLabel: 'リンクを追加',
      itemFields: [
        { kind: 'text', key: 'label', label: '表示名', placeholder: '例: Gmail' },
        { kind: 'text', key: 'url', label: 'URL', placeholder: 'https://example.com' },
        { kind: 'icon', key: 'icon', label: 'アイコン' },
      ],
      presets: LINK_ADD_PRESETS,
    },
    { kind: 'toggle', key: 'openInNewTab', label: '新しいタブで開く' },
    {
      kind: 'select',
      key: 'alignment',
      label: '配置',
      variant: 'tabs',
      options: [
        { value: 'left', label: '左寄せ' },
        { value: 'center', label: '中央寄せ' },
        { value: 'right', label: '右寄せ' },
      ],
    },
    {
      kind: 'select',
      key: 'iconSize',
      label: 'アイコンの大きさ',
      options: [
        { value: 'small', label: '小' },
        { value: 'medium', label: '中' },
        { value: 'large', label: '大' },
      ],
    },
    { kind: 'toggle', key: 'showLabels', label: 'リンク名を表示' },
    {
      kind: 'number',
      key: 'columns',
      label: '1行に並べる数（0で自動）',
      min: 0,
      max: 12,
      step: 1,
    },
    {
      kind: 'select',
      key: 'svgIconColorMode',
      label: 'SVGアイコンの色',
      help: 'アイコン設定で「SVG」を選んだものだけに、ウィジェット単位でまとめて適用されます。',
      options: [
        { value: 'auto', label: '自動（文字色に合わせる）' },
        { value: 'custom', label: '色を指定' },
      ],
    },
    {
      kind: 'color',
      key: 'svgIconColor',
      label: 'SVGアイコンの色（指定）',
      visibleWhen: { key: 'svgIconColorMode', equals: 'custom' },
    },
  ],
  Component: LinksWidget,
});
