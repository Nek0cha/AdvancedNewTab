import type { RssFetchRequest, RssFetchResponse } from '@/lib/messages';

/**
 * newtab から background へ RSS 取得を依頼する。
 * background で取得する理由は lib/messages.ts の冒頭コメントを参照。
 */
export async function fetchFeedViaBackground(url: string): Promise<string> {
  const request: RssFetchRequest = { type: 'ant/rss-fetch', url };
  const response = (await browser.runtime.sendMessage(request)) as RssFetchResponse | undefined;

  if (!response) throw new Error('background との通信に失敗しました');
  if (!response.ok || response.text === undefined) {
    throw new Error(response.error ?? 'フィードの取得に失敗しました');
  }
  return response.text;
}
