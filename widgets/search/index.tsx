import { useState, type FormEvent } from 'react';
import { Search as SearchIcon } from 'lucide-react';

import { getWidgetBackgroundStyle, type WidgetBackgroundSettings } from '@/lib/widget-background';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from './search.module.css';

interface SearchSettings extends Record<string, unknown> {
  /** 検索結果を現在のタブで開くか、新しいタブで開くか */
  openInNewTab: boolean;
  placeholder: string;
}

function SearchWidget({ settings, editMode }: WidgetProps<SearchSettings>) {
  const [value, setValue] = useState('');

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;

    // 検索エンジン自体は拡張機能側で選ばせず、常にブラウザに設定されている既定の
    // 検索エンジンで検索する（chrome.search / browser.search API、"search" 権限）。
    // 以前はGoogle/Bing/DuckDuckGo/カスタムURLを本ウィジェット内で切り替えられたが、
    // Chromeウェブストアの単一用途ポリシーで「新しいタブページの変更」と「検索設定の
    // 変更」の二重目的とみなされ却下された。ブラウザの検索設定を読み替えているだけで
    // 拡張機能が独自に管理しているわけではない、という状態にするため撤去している。
    browser.search
      .query({
        text: query,
        disposition: settings.openInNewTab ? 'NEW_TAB' : 'CURRENT_TAB',
      })
      .catch(() => {
        // 失敗しても入力欄はそのまま残し、ユーザーが再送信できるようにする
      });
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
  description: 'ブラウザの既定の検索エンジンでその場検索できます。',
  icon: SearchIcon,
  frame: 'bare',
  // 個別背景を検索バーの<form>だけに適用したいため、WidgetFrameの自動適用対象から外す
  // （上のコンポーネント内コメント参照）。
  backgroundScope: 'self',
  defaultLayout: { w: 6, h: 1, minW: 3, minH: 1 },
  defaultSettings: {
    openInNewTab: false,
    placeholder: '検索...',
  },
  settingsSchema: [
    { kind: 'text', key: 'placeholder', label: 'プレースホルダー文言' },
    { kind: 'toggle', key: 'openInNewTab', label: '新しいタブで結果を開く' },
  ],
  Component: SearchWidget,
});
