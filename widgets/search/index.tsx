import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { History, Search as SearchIcon, X } from 'lucide-react';

import { cx } from '@/lib/cx';
import { useT } from '@/lib/i18n';
import {
  addSearchHistory,
  clearSearchHistory,
  loadSearchHistory,
  matchSearchHistory,
  removeSearchHistory,
} from '@/lib/search-history';
import { getWidgetBackgroundStyle, type WidgetBackgroundSettings } from '@/lib/widget-background';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from './search.module.css';

interface SearchSettings extends Record<string, unknown> {
  /** 検索結果を現在のタブで開くか、新しいタブで開くか */
  openInNewTab: boolean;
  placeholder: string;
  /** 検索した語をこの端末に保存し、入力欄の下に候補として出すか（lib/search-history.ts） */
  historySuggest: boolean;
}

/** 候補として一度に出す件数 */
const MAX_SUGGESTIONS = 8;

function SearchWidget({ settings, editMode }: WidgetProps<SearchSettings>) {
  const t = useT();
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  // キーボードで選んでいる候補の位置。-1 は「入力欄そのもの」（何も選んでいない）
  const [highlight, setHighlight] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const formRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // 「候補を出さない」に切り替えたら、それまでの履歴も消す。候補に出さないだけで
  // 保存は続いている、という状態は、オフにした人の期待とずれるため。
  useEffect(() => {
    if (settings.historySuggest) return;
    setHistory([]);
    void clearSearchHistory().catch(() => {});
  }, [settings.historySuggest]);

  const suggestions = settings.historySuggest ? matchSearchHistory(history, value, MAX_SUGGESTIONS) : [];
  const showMenu = open && !editMode && suggestions.length > 0;

  // ウィジェットの枠は overflow: hidden で、グリッドの各セルは transform を持つため、
  // 候補の一覧は body 直下へポータルし、入力欄の位置から fixed で配置する
  // （components/Dropdown/Dropdown.tsx と同じ理由・同じやり方）。
  useLayoutEffect(() => {
    if (!showMenu || !formRef.current) return;
    const rect = formRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 240 && rect.top > spaceBelow;
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(openUpward ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  }, [showMenu]);

  useEffect(() => {
    if (!showMenu) return;
    const onScroll = (e: Event): void => {
      // 一覧の内側のスクロールでは閉じない（Dropdown.tsx の同じ処理の注記を参照）
      if (e.target instanceof Node && listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onResize = (): void => setOpen(false);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [showMenu]);

  const search = (raw: string): void => {
    const query = raw.trim();
    if (!query) return;
    setOpen(false);
    setHighlight(-1);
    if (settings.historySuggest) {
      void addSearchHistory(query)
        .then(setHistory)
        .catch(() => {});
    }

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

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const picked = showMenu && highlight >= 0 ? suggestions[highlight] : undefined;
    if (picked !== undefined) setValue(picked);
    search(picked ?? value);
  };

  const remove = (query: string): void => {
    setHighlight(-1);
    void removeSearchHistory(query)
      .then(setHistory)
      .catch(() => {});
  };

  // 個別背景は検索バー（<form>）だけに適用する。ウィジェット全体を包むと、
  // グリッドセルの方が検索バーより横に広いときに余白まで塗られてしまうため、
  // widgets/types.ts の backgroundScope:'self' でWidgetFrame側の自動適用を止め、
  // ここで自前適用している（widgets/registry.ts が注入した設定値を使う）。
  const backgroundStyle = getWidgetBackgroundStyle(settings as unknown as WidgetBackgroundSettings);

  return (
    <div className={styles.root}>
      <form ref={formRef} className={styles.form} onSubmit={handleSubmit} style={backgroundStyle}>
        <SearchIcon size={16} className={styles.icon} />
        <input
          type="text"
          className={styles.input}
          placeholder={t(settings.placeholder)}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setHighlight(-1);
            setOpen(true);
          }}
          onFocus={() => {
            // 別のタブで検索した分も候補に出したいので、フォーカスのたびに読み直す
            if (settings.historySuggest) void loadSearchHistory().then(setHistory);
            setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!showMenu) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => (h + 1 >= suggestions.length ? -1 : h + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => (h - 1 < -1 ? suggestions.length - 1 : h - 1));
            } else if (e.key === 'Escape') {
              setOpen(false);
              setHighlight(-1);
            } else if (e.key === 'Delete' && e.shiftKey && highlight >= 0) {
              // アドレスバーと同じ Shift+Delete で、選んでいる候補を履歴から消せるようにする
              const target = suggestions[highlight];
              if (target !== undefined) {
                e.preventDefault();
                remove(target);
              }
            }
          }}
          role="combobox"
          aria-expanded={showMenu}
          aria-autocomplete="list"
          // 編集モード中はドラッグを優先させ、うっかり文字入力が始まらないようにする
          disabled={editMode}
        />
      </form>
      {showMenu &&
        createPortal(
          <ul ref={listRef} className={styles.menu} style={menuStyle} role="listbox">
            {suggestions.map((query, index) => (
              <li
                key={query}
                role="option"
                aria-selected={index === highlight}
                className={cx(styles.option, index === highlight && styles.optionActive)}
                // mousedown の既定動作（入力欄からフォーカスが外れる）を止めないと、
                // blur で一覧が閉じてしまい click が届かない
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => {
                  setValue(query);
                  search(query);
                }}
              >
                <History size={14} className={styles.optionIcon} />
                <span className={styles.optionText}>{query}</span>
                <button
                  type="button"
                  className={styles.removeButton}
                  title={t('この履歴を削除')}
                  aria-label={t('この履歴を削除')}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(query);
                  }}
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}

export const searchWidget = defineWidget<SearchSettings>({
  type: 'search',
  category: 'links',
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
    historySuggest: true,
  },
  settingsSchema: [
    { kind: 'text', key: 'placeholder', label: 'プレースホルダー文言' },
    { kind: 'toggle', key: 'openInNewTab', label: '新しいタブで結果を開く' },
    {
      kind: 'toggle',
      key: 'historySuggest',
      label: '検索履歴から候補を出す',
      help: '検索した語はこの端末の中にだけ保存されます。オフにすると、保存済みの履歴も削除されます。',
    },
  ],
  Component: SearchWidget,
});
