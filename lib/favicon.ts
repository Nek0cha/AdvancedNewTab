import { isExtensionContext } from '@/lib/platform';

/**
 * MV3 では chrome://favicon/ が廃止されているため、拡張機能同梱の _favicon エンドポイントを使う。
 * manifest.json 側で "favicon" 権限の宣言が必要（wxt.config.ts 参照）。
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#getting_started
 *
 * 拡張機能コンテキスト以外（静的サイト版、entrypoints/webapp）には _favicon エンドポイントが
 * 存在しないため、キー不要で使える公開のfavicon取得サービスにフォールバックする。
 * こちらは対象サイトへの通信が発生する（拡張機能版は同梱APIのため通信が発生しない）。
 */
export function faviconUrl(pageUrl: string, size = 32): string {
  if (!isExtensionContext()) {
    const host = (() => {
      try {
        return new URL(pageUrl).hostname;
      } catch {
        return pageUrl;
      }
    })();
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
  }

  // WXT の getURL は既知のエントリポイントしか型で許さないため、
  // 拡張機能内部の固定エンドポイントである _favicon はここだけ any 経由で組み立てる。
  const url = new URL((browser.runtime.getURL as (path: string) => string)('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}
