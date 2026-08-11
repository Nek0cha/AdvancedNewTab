/**
 * YouTube/YouTube Music 用 content script の実行時登録。
 *
 * entrypoints/youtube-media.content.ts は `registration: 'runtime'` かつ matches
 * 未指定でビルドしている（manifest に host_permissions を焼き込ませないため）。
 * そのため、対象サイトへの optional_host_permissions が許可された後、
 * ここで browser.scripting.registerContentScripts() を呼んで初めて有効になる。
 * background.ts の起動時と、権限が新たに許可されたタイミングの両方で呼ぶ。
 */
import { YOUTUBE_MEDIA_CONTENT_SCRIPT_ID, YOUTUBE_MEDIA_HOSTS } from '@/lib/media-relay';

/** WXTのビルド出力先。entrypoints/youtube-media.content.ts → content-scripts/youtube-media.js */
const CONTENT_SCRIPT_JS = ['content-scripts/youtube-media.js'];

/**
 * background.ts はこの関数を起動時に1回だけ呼ぶ（YouTube権限が既に許可済みの
 * セッションでは permissions.onAdded は以後発火しないため、実質この1回きりの
 * チャンスになる）。ここで登録が失敗すると、ブラウザを再起動するかもう一度
 * 拡張機能をリロードするまでミニプレーヤーがずっと空のまま、という体感になる
 * （content scriptが1つも差し込まれないので再生状態が一切飛んでこない）。
 * 一度成功すれば persistAcrossSessions によりそのセッション中はずっと有効なので
 * 「直ったらそのあとは平気」という報告と一致する。
 * MV3のservice worker起床直後は scripting API がまだ完全に使える状態でない
 * ことがある（内部的な初期化タイミングの問題）ため、失敗時は少し待って
 * 数回まで再試行する。
 */
const RETRY_DELAYS_MS = [300, 1000, 3000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function registerOnce(): Promise<void> {
  const granted = await browser.permissions.contains({ origins: YOUTUBE_MEDIA_HOSTS });

  // 「無ければ登録」ではなく「一旦消してから、必要なら登録し直す」方式にしている。
  // background.ts はこの関数を起動時と permissions.onAdded（YouTube以外の権限が
  // 許可された時も含め、どの権限の追加でも発火する）の両方から呼ぶため、
  // getRegisteredContentScripts() で「無い」と判定した直後に、もう一方の呼び出しが
  // 先に登録を済ませてしまう競合が起こり得る。その状態で registerContentScripts() を
  // 呼ぶと「Duplicate script ID」で失敗していた。先にunregisterしておけば、
  // 登録が実在するかどうかの判定に依存しないため、この競合が起こらない
  // （unregisterは対象が無くても失敗しないため、単に無視すればよい）。
  await browser.scripting.unregisterContentScripts({ ids: [YOUTUBE_MEDIA_CONTENT_SCRIPT_ID] }).catch(() => {
    // 元々登録されていなければここで何も起きない（Chromeはno-opにする）。
    // 万一エラーになる実装であっても、後続の登録判断には影響しないため無視する。
  });

  if (granted) {
    await browser.scripting.registerContentScripts([
      {
        id: YOUTUBE_MEDIA_CONTENT_SCRIPT_ID,
        matches: YOUTUBE_MEDIA_HOSTS,
        js: CONTENT_SCRIPT_JS,
        runAt: 'document_idle',
        persistAcrossSessions: true,
      },
    ]);
  }
  // 権限が無い場合は、直前のunregisterで既に片付いているので何もしなくてよい
  // （ユーザーが chrome://extensions から手動で権限を外した場合の掃除もこれで兼ねる）。
}

export async function ensureYoutubeMediaContentScript(): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await registerOnce();
      return;
    } catch (error) {
      const nextDelay = RETRY_DELAYS_MS[attempt];
      if (nextDelay === undefined) {
        console.error('[AdvancedNewTab] YouTubeメディア content script の登録に失敗しました', error);
        return;
      }
      await delay(nextDelay);
    }
  }
}
