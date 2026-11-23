/**
 * リンク集で URL を入れたとき、表示名とアイコンを自動で埋めるための問い合わせ。
 *
 * 新しい権限は一切要求しない。URL を貼るたびに「このサイトへのアクセスを許可しますか」と
 * 聞かれるのは、名前を1つ埋めるだけの便利機能には重すぎるため。代わりに、すでに手元にある
 * 情報だけを上から順に試す。
 *
 * 1. 同梱のプリセット（lib/link-presets.ts）にあるサイトなら、その名前と公式ロゴ
 * 2. 他のウィジェットのためにそのサイトへのアクセスがすでに許可されていれば、ページの名前
 * 3. 履歴の権限がすでに許可されていれば、閲覧履歴に残っているページの名前
 * 4. どれも無ければホスト名（例: mail.google.com）
 *
 * プリセットに無いサイトのアイコンは「既定」を返す。既定のままならリンク集は favicon を
 * 自動で表示する。わざわざ「既定」を返すのは、打ちかけの URL がたまたまプリセットに当たって
 * ロゴが入った後、別のサイトの URL に打ち直したときに、そのロゴを元に戻すため
 * （Field 側は、自動入力した値のまま手つかずの欄だけを上書きする）。
 */

import { DEFAULT_ICON_VALUE, type IconValue } from '@/lib/icon-value';
import { LINK_PRESETS } from '@/lib/link-presets';
import { isExtensionContext } from '@/lib/platform';

/** ページの取得を諦めるまでの時間。設定パネルで待たされている感じを出さないよう短めにする。 */
const FETCH_TIMEOUT_MS = 4000;

/** ユーザー入力の URL を解釈する。プロトコル省略時は https を仮定する。 */
export function parseLinkUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    // http://localhost:3000 のように、スキームまで書かれていればドットが無くても受け付ける
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    // スキーム省略として下で解釈し直す
  }
  try {
    const url = new URL(`https://${trimmed}`);
    // 打ちかけの「git」のようなドットの無い入力も https://git/ として解釈できてしまうため弾く
    return url.hostname.includes('.') ? url : null;
  } catch {
    return null;
  }
}

const stripWww = (host: string): string => host.replace(/^www\./, '');

function findPreset(url: URL): { label: string; icon: IconValue } | null {
  const host = stripWww(url.hostname);
  const preset = LINK_PRESETS.find((p) => {
    try {
      return stripWww(new URL(p.url).hostname) === host;
    } catch {
      return false;
    }
  });
  return preset ? { label: preset.name, icon: preset.icon } : null;
}

/**
 * ページの HTML から、リンク名として使いやすい名前を取り出す。
 * og:site_name（例: 「GitHub」）を優先し、無ければ <title> を使う。<title> は
 * 「GitHub: Let's build from here」のように長いことが多く、リンクの名前としては
 * サイト名の方が短くて分かりやすいため。
 */
function extractName(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const candidates = [
    doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content'),
    doc.querySelector('meta[name="application-name"]')?.getAttribute('content'),
    doc.querySelector('title')?.textContent,
  ];
  for (const c of candidates) {
    const name = c?.replace(/\s+/g, ' ').trim();
    if (name) return name;
  }
  return null;
}

async function fetchPageName(url: URL): Promise<string | null> {
  // 許可済みかどうかを先に確かめる。許可の無いサイトへの fetch は CORS で失敗するだけだが、
  // 失敗が拡張機能のエラー一覧に積もっていくのを避けたい。
  const granted = await browser.permissions.contains({ origins: [`${url.origin}/*`] });
  if (!granted) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal, credentials: 'omit' });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) return null;
    return extractName(await res.text());
  } finally {
    clearTimeout(timer);
  }
}

async function findHistoryTitle(url: URL): Promise<string | null> {
  const granted = await browser.permissions.contains({ permissions: ['history'] });
  if (!granted) return null;
  const results = await browser.history.search({ text: url.hostname, startTime: 0, maxResults: 50 });
  const href = url.toString();
  // 入力された URL そのものを最優先し、無ければ同じサイトのトップページの名前を使う
  const exact = results.find((r) => r.url === href && r.title);
  const root = results.find((r) => r.url === `${url.origin}/` && r.title);
  return (exact ?? root)?.title?.trim() || null;
}

/** FieldSchema(list) の autofill.resolve としてリンク集から使う。 */
export async function resolveLinkAutofill(item: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const url = typeof item.url === 'string' ? parseLinkUrl(item.url) : null;
  if (!url) return null;

  const preset = findPreset(url);
  if (preset) return preset;

  if (isExtensionContext()) {
    // どちらの問い合わせが失敗しても、次の手段に進めば済むので握りつぶす
    const name =
      (await fetchPageName(url).catch(() => null)) ?? (await findHistoryTitle(url).catch(() => null));
    if (name) return { label: name, icon: DEFAULT_ICON_VALUE };
  }

  return { label: stripWww(url.hostname), icon: DEFAULT_ICON_VALUE };
}
