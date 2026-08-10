import { Link2 } from 'lucide-react';

import { IconValueDisplay } from '@/components/IconValueDisplay/IconValueDisplay';
import { faviconUrl } from '@/lib/favicon';
import { normalizeIconValue } from '@/lib/icon-value';
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
}

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

function LinksWidget({ settings, editMode }: WidgetProps<LinksSettings>) {
  const items = settings.items.filter((item) => normalizeUrl(item.url));

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        リンクが登録されていません。編集モードでウィジェットの設定からリンクを追加してください。
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        {items.map((item, index) => {
          const url = normalizeUrl(item.url);
          if (!url) return null;
          return (
            <a
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className={styles.item}
              href={url}
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
                  size={20}
                  className={styles.icon}
                  svgTint={settings.svgIconColor || undefined}
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
  name: 'リンク集',
  description: 'よく使うサイトへのリンクをアイコン付きで並べます。',
  icon: Link2,
  defaultLayout: { w: 4, h: 3, minW: 2, minH: 2 },
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
      kind: 'color',
      key: 'svgIconColor',
      label: 'SVGアイコンの色',
      help: 'アイコン設定で「SVG」を選んだものだけに、ウィジェット単位でまとめて適用されます。',
    },
  ],
  Component: LinksWidget,
});
