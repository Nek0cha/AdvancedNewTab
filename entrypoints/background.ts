import { cached } from '@/lib/cache';
import { ensureYoutubeMediaContentScript } from '@/lib/media-registration';
import type { MediaControlMessage, MediaGetMessage, MediaState, MediaStateMessage } from '@/lib/media-relay';
import { MediaStore } from '@/lib/media-store';
import { isRssFetchRequest, type RssFetchResponse } from '@/lib/messages';
import { loadState } from '@/lib/storage';

/** RSSは分単位で追う情報ではないため、この間隔は使い回す。widgets/rss/index.tsx と揃えている。 */
const RSS_TTL_MS = 15 * 60 * 1000;
const RSS_REFRESH_ALARM = 'ant-refresh-rss';

async function fetchFeedText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`フィードの取得に失敗しました（${res.status}）`);
  return res.text();
}

/**
 * 設定済みの全 RSS ウィジェットを見て、キャッシュを温めておく。
 *
 * newtab を開いていなくても chrome.alarms で定期的に呼ばれるため、
 * ユーザーが次に新規タブを開いた瞬間には既に取得済みの状態を作れる（lib/cache.ts 参照）。
 */
async function refreshAllRssFeeds(): Promise<void> {
  const state = await loadState();
  const feedUrls = new Set<string>();

  for (const widget of Object.values(state.widgets)) {
    if (widget.type !== 'rss') continue;
    const feedUrl = (widget.settings as { feedUrl?: unknown }).feedUrl;
    if (typeof feedUrl === 'string' && feedUrl.trim()) feedUrls.add(feedUrl.trim());
  }

  await Promise.all(
    [...feedUrls].map(async (url) => {
      try {
        // 権限が無いフィードは静かにスキップする（ユーザーがまだ許可していないだけなので、
        // ここでエラーを出す必要はない。newtab 側で改めて許可を求める）。
        const granted = await browser.permissions.contains({ origins: [new URL(url).origin + '/*'] });
        if (!granted) return;
        await cached(`rss:${url}`, RSS_TTL_MS, () => fetchFeedText(url));
      } catch (error) {
        console.error('[AdvancedNewTab] RSSの事前取得に失敗しました', url, error);
      }
    }),
  );
}

export default defineBackground(() => {
  // ツールバーアイコンをワンクリックで設定画面に直行させる（default_popup は設定しない）
  browser.action.onClicked.addListener(() => {
    void browser.runtime.openOptionsPage();
  });

  // --- YouTube/YouTube Music ミニプレーヤーの中継 ---------------------------
  //
  // content script（entrypoints/youtube-media.content.ts）から送られてくる
  // 再生状態を集約し、新規タブ側（複数開いていてもよい）へブロードキャストする。
  // 逆方向（操作コマンド）も、送信元タブへ中継する。
  const mediaStore = new MediaStore();

  function broadcastMediaState(): void {
    const { state } = mediaStore.current();
    void browser.runtime.sendMessage({ type: 'ant/media-broadcast', state }).catch(() => {
      // 新規タブが1枚も開かれていないと受け手がおらず reject するが、正常なので無視する
    });
  }

  // 起動時に、既に許可済みなら content script を登録し直す
  // （拡張機能の再読み込み・ブラウザ再起動後は動的登録が消えていることがあるため）。
  void ensureYoutubeMediaContentScript();

  // ウィジェット追加時に chrome.permissions.request() で許可されたタイミングを捕まえて登録する
  browser.permissions.onAdded.addListener(() => {
    void ensureYoutubeMediaContentScript();
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    mediaStore.remove(tabId);
    broadcastMediaState();
  });

  // newtab からの即時取得リクエスト（CORS制約を受けずに取得できる。lib/messages.ts 参照）
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isRssFetchRequest(message)) {
      fetchFeedText(message.url)
        .then((text) => sendResponse({ ok: true, text } satisfies RssFetchResponse))
        .catch((error: unknown) =>
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          } satisfies RssFetchResponse),
        );
      return true; // 非同期で sendResponse するために true を返す
    }

    const type = (message as { type?: string } | undefined)?.type;

    if (type === 'ant/media-state') {
      const tabId = sender.tab?.id;
      if (tabId !== undefined) {
        mediaStore.set(tabId, (message as MediaStateMessage).state);
        broadcastMediaState();
      }
      return undefined;
    }

    if (type === 'ant/media-get') {
      void message; // MediaGetMessage には中身がない
      sendResponse({ type: 'ant/media-broadcast', state: mediaStore.current().state });
      return undefined;
    }

    if (type === 'ant/media-control') {
      const { tabId } = mediaStore.current();
      const { action, time } = message as MediaControlMessage;
      if (tabId !== null) {
        void browser.tabs.sendMessage(tabId, { type: 'ant/media-do', action, time }).catch(() => {});
      }
      return undefined;
    }

    return undefined;
  });

  browser.alarms.create(RSS_REFRESH_ALARM, { periodInMinutes: 15 });
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === RSS_REFRESH_ALARM) void refreshAllRssFeeds();
  });
});
