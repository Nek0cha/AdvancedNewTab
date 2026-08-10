/**
 * MV3 では chrome://favicon/ が廃止されているため、拡張機能同梱の _favicon エンドポイントを使う。
 * manifest.json 側で "favicon" 権限の宣言が必要（wxt.config.ts 参照）。
 * https://developer.chrome.com/docs/extensions/reference/api/tabs#getting_started
 */
export function faviconUrl(pageUrl: string, size = 32): string {
  // WXT の getURL は既知のエントリポイントしか型で許さないため、
  // 拡張機能内部の固定エンドポイントである _favicon はここだけ any 経由で組み立てる。
  const url = new URL((browser.runtime.getURL as (path: string) => string)('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', String(size));
  return url.toString();
}
