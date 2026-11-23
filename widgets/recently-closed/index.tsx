import { useEffect, useState } from 'react';
import { AppWindow, History, Loader2 } from 'lucide-react';

import { PermissionGate } from '@/components/PermissionGate/PermissionGate';
import { faviconUrl } from '@/lib/favicon';
import { useIntlLocale, useT } from '@/lib/i18n';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import linkStyles from '../links/links.module.css';
import styles from './recently-closed.module.css';

interface RecentlyClosedSettings extends Record<string, unknown> {
  limit: number;
  /** 閉じたウィンドウ（複数タブをまとめて閉じたもの）も一覧に出すか */
  showWindows: boolean;
}

interface Entry {
  sessionId: string;
  kind: 'tab' | 'window';
  title: string;
  /** タブなら自身の URL、ウィンドウなら先頭タブの URL（favicon 用） */
  url: string;
  tabCount: number;
  /** 閉じた時刻（ms） */
  closedAt: number;
}

/** chrome.sessions.getRecentlyClosed が一度に返せる上限（sessions.MAX_SESSION_RESULTS） */
const MAX_RESULTS = 25;

/**
 * 新しいタブのページ自体も「閉じたタブ」として記録される。それが一覧に並んでも開き直す意味が
 * 無く、新しいタブを開いては閉じるたびに一覧が埋まってしまうため除く。
 */
function isOwnNewTab(url: string): boolean {
  return (
    url.startsWith(browser.runtime.getURL('/')) ||
    url.startsWith('chrome://newtab') ||
    url.startsWith('about:newtab') ||
    url.startsWith('about:home')
  );
}

function toEntries(sessions: Browser.sessions.Session[]): Entry[] {
  return sessions.flatMap((s): Entry[] => {
    // lastModified は秒単位（Chrome / Firefox とも）
    const closedAt = s.lastModified * 1000;
    if (s.tab?.sessionId && s.tab.url && !isOwnNewTab(s.tab.url)) {
      return [{ sessionId: s.tab.sessionId, kind: 'tab', title: s.tab.title || s.tab.url, url: s.tab.url, tabCount: 1, closedAt }];
    }
    if (s.window?.sessionId) {
      const tabs = (s.window.tabs ?? []).filter((tab) => tab.url && !isOwnNewTab(tab.url));
      const first = tabs[0];
      if (!first?.url) return [];
      return [
        { sessionId: s.window.sessionId, kind: 'window', title: first.title || first.url, url: first.url, tabCount: tabs.length, closedAt },
      ];
    }
    return [];
  });
}

/** 「3分前」のような相対時刻。1分未満は「たった今」相当の 0 分前ではなく秒で出す。 */
function formatAgo(ms: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const sec = Math.round((ms - Date.now()) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return rtf.format(sec, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour');
  return rtf.format(Math.round(sec / 86400), 'day');
}

function RecentlyClosedList({ settings, editMode }: WidgetProps<RecentlyClosedSettings>) {
  const t = useT();
  const locale = useIntlLocale();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 相対時刻（「5分前」）を古いまま出し続けないよう、1分ごとに描き直す
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = (): void => {
      browser.sessions
        .getRecentlyClosed({ maxResults: MAX_RESULTS })
        .then((sessions) => {
          if (!cancelled) setEntries(toEntries(sessions));
        })
        .catch((err: unknown) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });
    };
    load();
    // 別のタブを閉じたり、ここから開き直したりするたびに一覧を取り直す
    browser.sessions.onChanged.addListener(load);
    const timer = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => {
      cancelled = true;
      browser.sessions.onChanged.removeListener(load);
      clearInterval(timer);
    };
  }, []);

  if (error) {
    return <div className={linkStyles.empty}>{t('最近閉じたタブを読み込めませんでした: {error}', { error })}</div>;
  }
  if (!entries) {
    return (
      <div className={linkStyles.loading}>
        <Loader2 size={20} className={linkStyles.spinner} aria-hidden />
        <span>{t('読み込み中…')}</span>
      </div>
    );
  }

  const items = entries.filter((e) => settings.showWindows || e.kind === 'tab').slice(0, settings.limit);
  if (items.length === 0) {
    return <div className={linkStyles.empty}>{t('最近閉じたタブはありません。')}</div>;
  }

  return (
    <ul className={styles.list}>
      {items.map((entry) => (
        <li key={entry.sessionId}>
          <button
            type="button"
            className={styles.item}
            disabled={editMode}
            title={entry.kind === 'tab' ? entry.url : t('このウィンドウを開き直す')}
            // 復元は <a href> で開き直すのとは違い、閉じる前の戻る/進むの履歴や、
            // ウィンドウならタブの並びまで元どおりに戻る
            onClick={() => void browser.sessions.restore(entry.sessionId).catch(() => {})}
          >
            <span className={styles.iconWrap}>
              {entry.kind === 'window' ? (
                <AppWindow size={14} />
              ) : (
                <img className={styles.icon} src={faviconUrl(entry.url)} alt="" />
              )}
            </span>
            <span className={styles.title}>
              {entry.kind === 'window' ? t('ウィンドウ（{n} 個のタブ）', { n: entry.tabCount }) : entry.title}
            </span>
            <span className={styles.ago}>{formatAgo(entry.closedAt, locale)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RecentlyClosedWidget(props: WidgetProps<RecentlyClosedSettings>) {
  const t = useT();
  return (
    <PermissionGate
      permissions={{ chrome: ['sessions', 'tabs'] }}
      reason={t('最近閉じたタブを表示するには、タブの履歴へのアクセスを許可してください。')}
    >
      <RecentlyClosedList {...props} />
    </PermissionGate>
  );
}

export const recentlyClosedWidget = defineWidget<RecentlyClosedSettings>({
  type: 'recently-closed',
  category: 'links',
  name: '最近閉じたタブ',
  description: '最近閉じたタブやウィンドウを、クリックひとつで開き直せます。',
  icon: History,
  defaultLayout: { w: 4, h: 4, minW: 3, minH: 2 },
  // sessions だけでは、閉じたタブの URL とタイトルが空になる（Chrome の仕様で、
  // tabs.Tab の url / title / favIconUrl は tabs 権限かホスト権限がないと読めない）。
  permissions: { chrome: ['sessions', 'tabs'] },
  defaultSettings: { limit: 10, showWindows: true },
  settingsSchema: [
    { kind: 'number', key: 'limit', label: '表示件数', min: 1, max: MAX_RESULTS, step: 1 },
    { kind: 'toggle', key: 'showWindows', label: '閉じたウィンドウも表示する' },
  ],
  Component: RecentlyClosedWidget,
});
