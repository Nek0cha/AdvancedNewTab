import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';

import { PermissionGate } from '@/components/PermissionGate/PermissionGate';
import { faviconUrl } from '@/lib/favicon';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from '../links/links.module.css';

interface TopSitesSettings extends Record<string, unknown> {
  limit: number;
  openInNewTab: boolean;
}

interface Site {
  title: string;
  url: string;
}

function TopSitesList({ settings, editMode }: WidgetProps<TopSitesSettings>) {
  const [sites, setSites] = useState<Site[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    browser.topSites
      .get()
      .then((results) => {
        if (!cancelled) setSites(results.map((r) => ({ title: r.title, url: r.url })));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <div className={styles.empty}>よく使うサイトを読み込めませんでした: {error}</div>;
  }
  if (!sites) return null;

  const items = sites.slice(0, settings.limit);
  if (items.length === 0) {
    return <div className={styles.empty}>表示できるサイトがまだありません。</div>;
  }

  return (
    <div className={styles.root}>
      <div className={styles.grid}>
        {items.map((site) => (
          <a
            key={site.url}
            className={styles.item}
            href={site.url}
            target={settings.openInNewTab ? '_blank' : undefined}
            rel={settings.openInNewTab ? 'noopener noreferrer' : undefined}
            onClick={(e) => {
              if (editMode) e.preventDefault();
            }}
          >
            <span className={styles.iconWrap}>
              <img className={styles.icon} src={faviconUrl(site.url)} alt="" />
            </span>
            <span className={styles.label}>{site.title || new URL(site.url).hostname}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function TopSitesWidget(props: WidgetProps<TopSitesSettings>) {
  return (
    <PermissionGate
      permissions={{ chrome: ['topSites'] }}
      reason="よく使うサイトを表示するには、閲覧履歴の頻度データへのアクセスを許可してください。"
    >
      <TopSitesList {...props} />
    </PermissionGate>
  );
}

export const topSitesWidget = defineWidget<TopSitesSettings>({
  type: 'topsites',
  name: 'よく使うサイト',
  description: 'ブラウザの閲覧頻度をもとに、よく訪れるサイトを表示します。',
  icon: TrendingUp,
  defaultLayout: { w: 4, h: 3, minW: 2, minH: 2 },
  // favicon は必須権限としてすでに付与されているため、ここでは topSites のみを要求する
  permissions: { chrome: ['topSites'] },
  defaultSettings: { limit: 8, openInNewTab: false },
  settingsSchema: [
    { kind: 'number', key: 'limit', label: '表示件数', min: 1, max: 20, step: 1 },
    { kind: 'toggle', key: 'openInNewTab', label: '新しいタブで開く' },
  ],
  Component: TopSitesWidget,
});
