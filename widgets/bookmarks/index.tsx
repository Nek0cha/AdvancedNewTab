import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

import { PermissionGate } from '@/components/PermissionGate/PermissionGate';
import { faviconUrl } from '@/lib/favicon';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from '../links/links.module.css';

interface BookmarksSettings extends Record<string, unknown> {
  limit: number;
  openInNewTab: boolean;
}

interface Bookmark {
  id: string;
  title: string;
  url: string;
}

function BookmarksList({ settings, editMode }: WidgetProps<BookmarksSettings>) {
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 直近に追加されたブックマークを新着順で取得する。フォルダ構成に依存しないため、
    // どのブラウザ・どんな整理の仕方をしていても素直に動く。
    browser.bookmarks
      .getRecent(settings.limit)
      .then((results) => {
        if (cancelled) return;
        setBookmarks(
          results
            .filter((node): node is typeof node & { url: string } => Boolean(node.url))
            .map((node) => ({ id: node.id, title: node.title, url: node.url })),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [settings.limit]);

  if (error) {
    return <div className={styles.empty}>ブックマークを読み込めませんでした: {error}</div>;
  }
  if (!bookmarks) return null;

  if (bookmarks.length === 0) {
    return <div className={styles.empty}>ブックマークがまだありません。</div>;
  }

  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        {bookmarks.map((bookmark) => (
          <a
            key={bookmark.id}
            className={styles.item}
            href={bookmark.url}
            target={settings.openInNewTab ? '_blank' : undefined}
            rel={settings.openInNewTab ? 'noopener noreferrer' : undefined}
            onClick={(e) => {
              if (editMode) e.preventDefault();
            }}
          >
            <span className={styles.iconWrap}>
              <img className={styles.icon} src={faviconUrl(bookmark.url)} alt="" />
            </span>
            <span className={styles.label}>{bookmark.title || new URL(bookmark.url).hostname}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function BookmarksWidget(props: WidgetProps<BookmarksSettings>) {
  return (
    <PermissionGate
      permissions={{ chrome: ['bookmarks'] }}
      reason="ブックマークを表示するには、ブックマークへのアクセスを許可してください。"
    >
      <BookmarksList {...props} />
    </PermissionGate>
  );
}

export const bookmarksWidget = defineWidget<BookmarksSettings>({
  type: 'bookmarks',
  name: 'ブックマーク',
  description: '最近追加したブックマークを一覧表示します。',
  icon: Star,
  defaultLayout: { w: 4, h: 3, minW: 2, minH: 2 },
  // favicon は必須権限としてすでに付与されているため、ここでは bookmarks のみを要求する
  permissions: { chrome: ['bookmarks'] },
  defaultSettings: { limit: 8, openInNewTab: false },
  settingsSchema: [
    { kind: 'number', key: 'limit', label: '表示件数', min: 1, max: 30, step: 1 },
    { kind: 'toggle', key: 'openInNewTab', label: '新しいタブで開く' },
  ],
  Component: BookmarksWidget,
});
