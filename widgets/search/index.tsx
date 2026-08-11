import { useState, type FormEvent } from 'react';
import { Search as SearchIcon } from 'lucide-react';

import { getWidgetBackgroundStyle, type WidgetBackgroundSettings } from '@/lib/widget-background';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from './search.module.css';

interface SearchSettings extends Record<string, unknown> {
  engine: 'google' | 'bing' | 'duckduckgo' | 'custom';
  /** engine === 'custom' のときに使う。"%s" を検索語に置換する */
  customUrlTemplate: string;
  /** 検索結果を現在のタブで開くか、新しいタブで開くか */
  openInNewTab: boolean;
  placeholder: string;
}

const ENGINE_TEMPLATES: Record<Exclude<SearchSettings['engine'], 'custom'>, string> = {
  google: 'https://www.google.com/search?q=%s',
  bing: 'https://www.bing.com/search?q=%s',
  duckduckgo: 'https://duckduckgo.com/?q=%s',
};

function buildSearchUrl(settings: SearchSettings, query: string): string {
  const template =
    settings.engine === 'custom' ? settings.customUrlTemplate : ENGINE_TEMPLATES[settings.engine];
  const encoded = encodeURIComponent(query);
  return template.includes('%s') ? template.replace('%s', encoded) : `${template}${encoded}`;
}

function SearchWidget({ settings, editMode }: WidgetProps<SearchSettings>) {
  const [value, setValue] = useState('');

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;

    const url = buildSearchUrl(settings, query);
    if (settings.openInNewTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  };

  // 個別背景は検索バー（<form>）だけに適用する。ウィジェット全体を包むと、
  // グリッドセルの方が検索バーより横に広いときに余白まで塗られてしまうため、
  // widgets/types.ts の backgroundScope:'self' でWidgetFrame側の自動適用を止め、
  // ここで自前適用している（widgets/registry.ts が注入した設定値を使う）。
  const backgroundStyle = getWidgetBackgroundStyle(settings as unknown as WidgetBackgroundSettings);

  return (
    <div className={styles.root}>
      <form className={styles.form} onSubmit={handleSubmit} style={backgroundStyle}>
        <SearchIcon size={16} className={styles.icon} />
        <input
          type="text"
          className={styles.input}
          placeholder={settings.placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          // 編集モード中はドラッグを優先させ、うっかり文字入力が始まらないようにする
          disabled={editMode}
        />
      </form>
    </div>
  );
}

export const searchWidget = defineWidget<SearchSettings>({
  type: 'search',
  name: '検索',
  description: '好きな検索エンジンにその場で検索できます。',
  icon: SearchIcon,
  frame: 'bare',
  // 個別背景を検索バーの<form>だけに適用したいため、WidgetFrameの自動適用対象から外す
  // （上のコンポーネント内コメント参照）。
  backgroundScope: 'self',
  defaultLayout: { w: 6, h: 1, minW: 3, minH: 1 },
  defaultSettings: {
    engine: 'google',
    customUrlTemplate: 'https://www.google.com/search?q=%s',
    openInNewTab: false,
    placeholder: '検索...',
  },
  settingsSchema: [
    {
      kind: 'select',
      key: 'engine',
      label: '検索エンジン',
      options: [
        { value: 'google', label: 'Google' },
        { value: 'bing', label: 'Bing' },
        { value: 'duckduckgo', label: 'DuckDuckGo' },
        { value: 'custom', label: 'カスタムURL' },
      ],
    },
    {
      kind: 'text',
      key: 'customUrlTemplate',
      label: 'カスタムURL（%s が検索語に置き換わります）',
      placeholder: 'https://example.com/search?q=%s',
      help: '検索エンジンが「カスタムURL」のときだけ使われます。',
    },
    { kind: 'text', key: 'placeholder', label: 'プレースホルダー文言' },
    { kind: 'toggle', key: 'openInNewTab', label: '新しいタブで結果を開く' },
  ],
  Component: SearchWidget,
});
