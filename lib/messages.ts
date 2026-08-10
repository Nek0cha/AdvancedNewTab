/**
 * newtab ページと background service worker の間でやり取りするメッセージの型。
 *
 * RSS の取得を background 側に寄せているのは CORS 回避のためだけではない。
 * background は newtab を開いていなくても chrome.alarms で起動できるため、
 * ユーザーが次に新規タブを開いた瞬間にはすでに取得済みのキャッシュがある状態を作れる
 * （lib/cache.ts のコメントも参照）。
 */

export interface RssFetchRequest {
  type: 'ant/rss-fetch';
  url: string;
}

export interface RssFetchResponse {
  ok: boolean;
  text?: string;
  error?: string;
}

export function isRssFetchRequest(message: unknown): message is RssFetchRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { type?: unknown }).type === 'ant/rss-fetch'
  );
}
