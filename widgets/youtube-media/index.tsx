import { useEffect, useRef, useState } from 'react';
import { Music2, Pause, Play, SkipBack, SkipForward } from 'lucide-react';

import { Marquee } from '@/components/Marquee/Marquee';
import { PermissionGate } from '@/components/PermissionGate/PermissionGate';
import { cx } from '@/lib/cx';
import { YOUTUBE_MEDIA_HOSTS, type MediaBroadcastMessage, type MediaState } from '@/lib/media-relay';
import { defineWidget, type WidgetProps } from '@/widgets/types';

import styles from './youtube-media.module.css';

interface YoutubeMediaSettings extends Record<string, unknown> {
  /** シークバー（下部の再生位置バー）を表示するか */
  showSeekBar: boolean;
}

function sendControl(action: 'playpause' | 'next' | 'previous'): void {
  void browser.runtime.sendMessage({ type: 'ant/media-control', action }).catch(() => {});
}

function sendSeek(time: number): void {
  void browser.runtime.sendMessage({ type: 'ant/media-control', action: 'seek', time }).catch(() => {});
}

/** 秒数を "3:45" / 1時間以上なら "1:03:45" の形式にする。 */
function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '0:00';
  const total = Math.floor(totalSeconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * 現在の再生位置を「滑らかに」表示するためのフック。
 *
 * content script からの状態送信は1秒間隔のポーリングなので、そのまま
 * state.currentTime を出すと表示が1秒ごとにカクつく。再生中は
 * `currentTime + 受信からの経過時間` で見た目上だけ補間し、250ms間隔で
 * 再描画することで滑らかに進んでいるように見せる。シーク操作中
 * （seekingTime が数値のとき）はその値を最優先で表示する。
 */
function useDisplayedTime(state: MediaState | null, seekingTime: number | null): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (seekingTime != null || !state?.playing) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [state?.playing, seekingTime]);

  if (seekingTime != null) return seekingTime;
  if (!state) return 0;
  if (!state.playing) return state.currentTime;

  const elapsed = (Date.now() - state.capturedAt) / 1000;
  const raw = state.currentTime + Math.max(0, elapsed);
  return state.duration > 0 ? Math.min(state.duration, raw) : raw;
}

function SeekBar({ state }: { state: MediaState }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [seekingTime, setSeekingTime] = useState<number | null>(null);
  const displayedTime = useDisplayedTime(state, seekingTime);
  const duration = state.duration;

  const timeAtClientX = (clientX: number): number | null => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || duration <= 0) return null;
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return fraction * duration;
  };

  useEffect(() => {
    if (seekingTime == null) return;

    const onMove = (e: PointerEvent): void => {
      const t = timeAtClientX(e.clientX);
      if (t != null) setSeekingTime(t);
    };
    const onUp = (e: PointerEvent): void => {
      const t = timeAtClientX(e.clientX);
      sendSeek(t ?? seekingTime);
      setSeekingTime(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekingTime]);

  const fraction = duration > 0 ? Math.min(1, Math.max(0, displayedTime / duration)) : 0;

  return (
    <div className={styles.seekRow}>
      <span className={styles.seekTime}>{formatTime(displayedTime)}</span>
      <div
        ref={trackRef}
        className={styles.seekTrack}
        onPointerDown={(e) => {
          const t = timeAtClientX(e.clientX);
          if (t != null) setSeekingTime(t);
        }}
      >
        <div className={styles.seekFill} style={{ width: `${fraction * 100}%` }} />
        <div className={styles.seekThumb} style={{ left: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}

function PlayerContent({ settings }: { settings: YoutubeMediaSettings }) {
  const [state, setState] = useState<MediaState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // マウント直後に現在値を取りに行く（それまでは何も再生していない扱いにしない）
    void browser.runtime
      .sendMessage({ type: 'ant/media-get' })
      .then((response: MediaBroadcastMessage | undefined) => {
        if (!cancelled && response) setState(response.state);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    const onMessage = (message: unknown): void => {
      const msg = message as Partial<MediaBroadcastMessage> | undefined;
      if (msg?.type === 'ant/media-broadcast') setState(msg.state ?? null);
    };
    browser.runtime.onMessage.addListener(onMessage);

    return () => {
      cancelled = true;
      browser.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  if (!loaded) return null;

  if (!state) {
    return (
      <div className={styles.empty}>
        <Music2 size={20} />
        <span>YouTube / YouTube Musicで何か再生すると、ここに表示されます</span>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.mainRow}>
        <div className={styles.artworkWrap}>
          {state.artwork ? (
            <img className={styles.artwork} src={state.artwork} alt="" />
          ) : (
            <div className={styles.artworkFallback}>
              <Music2 size={18} />
            </div>
          )}
        </div>

        <div className={styles.info}>
          <Marquee className={styles.title} text={state.title} />
          <div className={styles.metaRow}>
            {state.artist && <span className={styles.artist}>{state.artist}</span>}
            {state.duration > 0 && <span className={styles.duration}>{formatTime(state.duration)}</span>}
          </div>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.controlButton}
            title="前へ"
            onClick={() => sendControl('previous')}
          >
            <SkipBack size={16} />
          </button>
          <button
            type="button"
            className={cx(styles.controlButton, styles.playButton)}
            title={state.playing ? '一時停止' : '再生'}
            onClick={() => sendControl('playpause')}
          >
            {state.playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            type="button"
            className={styles.controlButton}
            title="次へ"
            onClick={() => sendControl('next')}
          >
            <SkipForward size={16} />
          </button>
        </div>
      </div>

      {settings.showSeekBar && state.duration > 0 && <SeekBar state={state} />}
    </div>
  );
}

function YoutubeMediaWidget({ settings }: WidgetProps<YoutubeMediaSettings>) {
  return (
    <PermissionGate
      permissions={{ hosts: YOUTUBE_MEDIA_HOSTS }}
      reason="YouTube / YouTube Musicの再生状態を読み取るには、そのサイトへのアクセスを許可してください。"
    >
      <PlayerContent settings={settings} />
    </PermissionGate>
  );
}

export const youtubeMediaWidget = defineWidget<YoutubeMediaSettings>({
  type: 'youtube-media',
  name: 'YouTube ミニプレーヤー',
  description: 'YouTube / YouTube Musicで再生中の曲を操作できます。',
  icon: Music2,
  frame: 'card',
  defaultLayout: { w: 4, h: 2, minW: 3, minH: 1 },
  permissions: { hosts: YOUTUBE_MEDIA_HOSTS },
  defaultSettings: {
    showSeekBar: true,
  },
  settingsSchema: [
    { kind: 'toggle', key: 'showSeekBar', label: 'シークバーを表示', help: '再生位置の表示とドラッグでのシークができます。' },
  ],
  Component: YoutubeMediaWidget,
});
