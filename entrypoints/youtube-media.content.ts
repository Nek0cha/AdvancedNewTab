import type { MediaDoMessage, MediaSource, MediaState } from '@/lib/media-relay';

/**
 * YouTube / YouTube Music ミニプレーヤーの再生状態を監視し、background へ中継する。
 *
 * `registration: 'runtime'` にしているのは、host_permissions を必須権限として
 * manifest に焼き込ませないため。matches をここで指定すると WXT がビルド時に
 * それを必須の host_permissions へ追加してしまう（インストール時の警告対象になり、
 * 「ウィジェットを置くまで何も要求しない」という方針に反する）ため、matches は
 * 一切指定せず、background.ts が optional_host_permissions の許可後に
 * browser.scripting.registerContentScripts() で実行時登録する
 * （lib/media-relay.ts の YOUTUBE_MEDIA_HOSTS 参照）。
 */
export default defineContentScript({
  registration: 'runtime',
  runAt: 'document_idle',
  main(ctx) {
    const source: MediaSource = location.hostname.includes('music.youtube.com')
      ? 'youtube-music'
      : 'youtube';

    /** YouTube はタブタイトルの末尾に " - YouTube" を付けるため、mediaSession が
     * 使えない場合のフォールバックとして取り除く。 */
    function fallbackTitle(): string {
      return document.title.replace(/ - YouTube$/, '').trim();
    }

    function readVideo(): HTMLVideoElement | null {
      return document.querySelector('video');
    }

    function readState(): MediaState | null {
      const video = readVideo();
      const metadata = navigator.mediaSession?.metadata;
      const title = metadata?.title || fallbackTitle();

      // タイトルが取れない = そもそも再生対象が無いとみなす
      if (!title) return null;

      const playing = video ? !video.paused && !video.ended : navigator.mediaSession?.playbackState === 'playing';
      const artwork = metadata?.artwork?.length ? metadata.artwork[metadata.artwork.length - 1]!.src : null;
      // ライブ配信は duration が Infinity になることがあるため、有限の値だけ採用する。
      const duration = video && Number.isFinite(video.duration) ? video.duration : 0;

      return {
        source,
        title,
        artist: metadata?.artist ?? '',
        artwork,
        playing,
        url: location.href,
        currentTime: video?.currentTime ?? 0,
        duration,
        capturedAt: Date.now(),
      };
    }

    let lastSent = '';

    function sendIfChanged(): void {
      const state = readState();
      // capturedAt は呼ぶたびに変わり、currentTime も再生中は毎秒わずかに変化し続けるため、
      // そのまま比較すると再生中は「変化なし」判定が一切効かなくなり、一時停止中も含めて
      // 毎秒送り続けてしまう。秒単位に丸めた上で capturedAt を除いたものを比較用に使い、
      // 「実質的な変化（曲が変わった・再生位置が1秒進んだ等）」があるときだけ送る。
      const comparable = state ? { ...state, capturedAt: 0, currentTime: Math.floor(state.currentTime) } : null;
      const serialized = JSON.stringify(comparable);
      if (serialized === lastSent) return;
      lastSent = serialized;
      browser.runtime.sendMessage({ type: 'ant/media-state', state }).catch(() => {
        // newtab もbackgroundも受け手がいないタイミングは普通に起こるので無視する
      });
    }

    // サイト側の内部イベントに依存すると壊れやすいため、定期ポーリングで検知する。
    // YouTube/YT Music はSPAなので、動画切り替え時もページ遷移は起きないが、
    // navigator.mediaSession.metadata はその都度更新されるためポーリングで拾える。
    ctx.setInterval(sendIfChanged, 1000);
    sendIfChanged();

    // タブを閉じる/離脱するときは「何も再生していない」を伝える
    ctx.addEventListener(window, 'pagehide', () => {
      void browser.runtime.sendMessage({ type: 'ant/media-state', state: null }).catch(() => {});
    });

    function clickIfExists(selector: string): void {
      const el = document.querySelector<HTMLElement>(selector);
      el?.click();
    }

    browser.runtime.onMessage.addListener((message: MediaDoMessage) => {
      if (message?.type !== 'ant/media-do') return;

      switch (message.action) {
        case 'playpause': {
          const video = readVideo();
          if (video) {
            if (video.paused) void video.play().catch(() => {});
            else video.pause();
          }
          break;
        }
        case 'next':
          if (source === 'youtube-music') clickIfExists('.next-button, tp-yt-paper-icon-button.next-button');
          else clickIfExists('.ytp-next-button');
          break;
        case 'previous':
          if (source === 'youtube-music') clickIfExists('.previous-button, tp-yt-paper-icon-button.previous-button');
          else clickIfExists('.ytp-prev-button');
          break;
        case 'seek': {
          const video = readVideo();
          if (video && typeof message.time === 'number' && Number.isFinite(message.time)) {
            video.currentTime = Math.max(0, message.time);
          }
          break;
        }
      }

      // 操作直後は状態が変わっているはずなので、次のポーリングを待たず即時反映する
      setTimeout(sendIfChanged, 150);
    });
  },
});
