import { useEffect, useState } from 'react';
import { Rss } from 'lucide-react';

import { PermissionGate } from '@/components/PermissionGate/PermissionGate';
import { cached } from '@/lib/cache';
import { fetchFeedViaBackground } from '@/lib/rss-fetch';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import { parseFeed, type FeedItem } from './parse';
import styles from './rss.module.css';

interface RssSettings extends Record<string, unknown> {
  feedUrl: string;
  limit: number;
  openInNewTab: boolean;
}

/** background.ts の RSS_TTL_MS と揃えている。 */
const RSS_TTL_MS = 15 * 60 * 1000;

/** ユーザーが入力したフィードURLから、権限要求に使うオリジンパターンを作る。 */
function originPattern(feedUrl: string): string | null {
  try {
    return `${new URL(feedUrl).origin}/*`;
  } catch {
    return null;
  }
}

function formatDate(ms: number | null): string {
  if (ms === null) return '';
  const diffHours = (Date.now() - ms) / (1000 * 60 * 60);
  if (diffHours < 24) return `${Math.max(1, Math.round(diffHours))}時間前`;
  return new Date(ms).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

function RssContent({ settings }: WidgetProps<RssSettings>) {
  const [feedTitle, setFeedTitle] = useState('');
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    cached(`rss:${settings.feedUrl}`, RSS_TTL_MS, () => fetchFeedViaBackground(settings.feedUrl))
      .then((result) => {
        if (cancelled) return;
        const parsed = parseFeed(result.data);
        setFeedTitle(parsed.title);
        setItems(parsed.items);
        setStale(result.stale);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [settings.feedUrl]);

  if (error) {
    return <div className={styles.empty}>{error}</div>;
  }
  if (!items) return null;

  const visible = items.slice(0, settings.limit);
  if (visible.length === 0) {
    return <div className={styles.empty}>記事が見つかりませんでした。</div>;
  }

  return (
    <div className={styles.root}>
      {feedTitle && <div className={styles.feedTitle}>{feedTitle}</div>}
      {stale && <div className={styles.staleBadge}>オフラインのため前回取得時点の情報です</div>}
      <div className={styles.list}>
        {visible.map((item, index) => (
          <a
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className={styles.item}
            href={item.link}
            target={settings.openInNewTab ? '_blank' : undefined}
            rel={settings.openInNewTab ? 'noopener noreferrer' : undefined}
          >
            <div className={styles.itemTitle}>{item.title || '(タイトルなし)'}</div>
            {item.publishedAt !== null && (
              <div className={styles.itemDate}>{formatDate(item.publishedAt)}</div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

function RssWidget(props: WidgetProps<RssSettings>) {
  const pattern = originPattern(props.settings.feedUrl);

  if (!pattern) {
    return (
      <div className={styles.empty}>
        ウィジェットの設定からRSSフィードのURLを入力してください。
      </div>
    );
  }

  return (
    <PermissionGate
      permissions={{ hosts: [pattern] }}
      reason={`このフィード（${new URL(props.settings.feedUrl).host}）を読み込むには通信を許可してください。`}
    >
      <RssContent {...props} />
    </PermissionGate>
  );
}

export const rssWidget = defineWidget<RssSettings>({
  type: 'rss',
  name: 'RSSフィード',
  description: '指定したRSS/AtomフィードURLの新着記事を一覧表示します。',
  icon: Rss,
  defaultLayout: { w: 4, h: 4, minW: 2, minH: 2 },
  // フィードURLごとにオリジンが異なるため、追加時点では固定の権限を要求しない。
  // ウィジェット内で PermissionGate が実際の入力URLに応じて要求する。
  defaultSettings: { feedUrl: '', limit: 6, openInNewTab: true },
  settingsSchema: [
    {
      kind: 'text',
      key: 'feedUrl',
      label: 'フィードURL',
      placeholder: 'https://example.com/feed.xml',
    },
    { kind: 'number', key: 'limit', label: '表示件数', min: 1, max: 20, step: 1 },
    { kind: 'toggle', key: 'openInNewTab', label: '新しいタブで開く' },
  ],
  Component: RssWidget,
});
