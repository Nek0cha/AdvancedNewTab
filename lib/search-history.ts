/**
 * 検索ウィジェットの検索履歴。この端末の中にだけ保存し、外部には一切送らない。
 *
 * レイアウトやテーマと同じ PersistedState（lib/store.ts）には入れず、別のキーで持つ。
 * PersistedState に入れると、検索するたびに Undo の履歴が1つ積まれ、JSON のバックアップや
 * 「レイアウト保存」にも検索語が混ざって、他の端末や他の人に渡るおそれがあるため。
 *
 * 検索ウィジェットを複数置いても、履歴は1つを共有する。
 */

import { isExtensionContext } from '@/lib/platform';

const STORAGE_KEY = 'searchHistory';
/** 静的サイト版（chrome.storage が無い）で使う localStorage のキー */
const WEB_STORAGE_KEY = 'ant:search-history';
/** 古いものから捨てる。候補として出すのは数件なので、これだけあれば十分 */
const MAX_ENTRIES = 100;

function sanitize(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((q): q is string => typeof q === 'string' && q.trim() !== '') : [];
}

/** 新しい順に並んだ検索語の一覧を返す。 */
export async function loadSearchHistory(): Promise<string[]> {
  try {
    if (!isExtensionContext()) return sanitize(JSON.parse(localStorage.getItem(WEB_STORAGE_KEY) ?? '[]'));
    const stored = await browser.storage.local.get(STORAGE_KEY);
    return sanitize(stored[STORAGE_KEY]);
  } catch {
    return [];
  }
}

async function save(entries: string[]): Promise<void> {
  if (!isExtensionContext()) {
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(entries));
    return;
  }
  await browser.storage.local.set({ [STORAGE_KEY]: entries });
}

/**
 * 検索語を先頭に足す。大文字小文字だけ違う同じ語がすでにあれば、それを取り除いてから足す
 * （同じ語が候補に何度も並ばないようにするため）。保存後の一覧を返す。
 */
export async function addSearchHistory(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q) return loadSearchHistory();
  const lower = q.toLowerCase();
  const entries = [q, ...(await loadSearchHistory()).filter((e) => e.toLowerCase() !== lower)].slice(0, MAX_ENTRIES);
  await save(entries);
  return entries;
}

/** 1件だけ消す。保存後の一覧を返す。 */
export async function removeSearchHistory(query: string): Promise<string[]> {
  const entries = (await loadSearchHistory()).filter((e) => e !== query);
  await save(entries);
  return entries;
}

/** すべて消す。 */
export async function clearSearchHistory(): Promise<void> {
  await save([]);
}

/**
 * 入力中の文字に合う候補を選ぶ。前方一致を先に、途中に含むものを後に並べ、
 * どちらも新しい順を保つ。入力と完全に同じ語は、選んでも意味が無いので出さない。
 * 何も入力していなければ、最近の検索をそのまま出す。
 */
export function matchSearchHistory(entries: string[], input: string, limit: number): string[] {
  const q = input.trim().toLowerCase();
  if (!q) return entries.slice(0, limit);
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const e of entries) {
    const lower = e.toLowerCase();
    if (lower === q) continue;
    if (lower.startsWith(q)) prefix.push(e);
    else if (lower.includes(q)) contains.push(e);
  }
  return [...prefix, ...contains].slice(0, limit);
}
