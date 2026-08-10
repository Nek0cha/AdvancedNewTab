/**
 * 外部API取得結果のTTLキャッシュ。
 *
 * chrome.storage.session に置いているため、ブラウザを閉じれば自然に消える
 * （chrome.storage.local と違って端末に永続しない）。新規タブを開くたびに
 * 天気やRSSを取り直すと体感が遅くなるうえ相手サーバーへの負荷にもなるため、
 * ここで一定時間は使い回す。
 */

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  ttlMs: number;
}

const NAMESPACE = 'ant:cache:';

export async function readCache<T>(key: string): Promise<{ data: T; stale: boolean } | null> {
  try {
    const stored = await browser.storage.session.get(NAMESPACE + key);
    const entry = stored[NAMESPACE + key] as CacheEntry<T> | undefined;
    if (!entry) return null;
    const stale = Date.now() - entry.fetchedAt > entry.ttlMs;
    return { data: entry.data, stale };
  } catch (error) {
    console.error('[AdvancedNewTab] キャッシュの読み込みに失敗しました', error);
    return null;
  }
}

export async function writeCache<T>(key: string, data: T, ttlMs: number): Promise<void> {
  const entry: CacheEntry<T> = { data, fetchedAt: Date.now(), ttlMs };
  try {
    await browser.storage.session.set({ [NAMESPACE + key]: entry });
  } catch (error) {
    console.error('[AdvancedNewTab] キャッシュの書き込みに失敗しました', error);
  }
}

/**
 * キャッシュを優先して返しつつ、期限切れなら fetcher で取り直して更新する。
 *
 * stale なキャッシュがあれば「古いデータをすぐ返す」ことを優先し、取得に失敗しても
 * 画面が空白にならないようにする。キャッシュが無く取得にも失敗した場合のみ例外を投げる。
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; stale: boolean }> {
  const existing = await readCache<T>(key);
  if (existing && !existing.stale) return existing;

  try {
    const fresh = await fetcher();
    await writeCache(key, fresh, ttlMs);
    return { data: fresh, stale: false };
  } catch (error) {
    if (existing) return existing; // 古くても表示できるものがあれば優先する
    throw error;
  }
}
