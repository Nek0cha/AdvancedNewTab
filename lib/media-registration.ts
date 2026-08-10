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

export async function ensureYoutubeMediaContentScript(): Promise<void> {
  try {
    const granted = await browser.permissions.contains({ origins: YOUTUBE_MEDIA_HOSTS });
    const existing = await browser.scripting.getRegisteredContentScripts({
      ids: [YOUTUBE_MEDIA_CONTENT_SCRIPT_ID],
    });

    if (granted && existing.length === 0) {
      await browser.scripting.registerContentScripts([
        {
          id: YOUTUBE_MEDIA_CONTENT_SCRIPT_ID,
          matches: YOUTUBE_MEDIA_HOSTS,
          js: CONTENT_SCRIPT_JS,
          runAt: 'document_idle',
          persistAcrossSessions: true,
        },
      ]);
    } else if (!granted && existing.length > 0) {
      // 権限が取り消された場合（ユーザーが chrome://extensions から手動で外す等）は
      // 登録も外しておく。放置しても次回 matches 側で弾かれるだけだが、掃除しておく。
      await browser.scripting.unregisterContentScripts({ ids: [YOUTUBE_MEDIA_CONTENT_SCRIPT_ID] });
    }
  } catch (error) {
    console.error('[AdvancedNewTab] YouTubeメディア content script の登録に失敗しました', error);
  }
}
