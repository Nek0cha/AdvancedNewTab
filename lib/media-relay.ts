/**
 * YouTube / YouTube Music ミニプレーヤーの通信プロトコル。
 *
 * 新規タブページは他のタブの中身を直接見られないため、対象タブに注入した
 * content script が再生状態を background へ送り、background がそれを集約して
 * 新規タブ側（複数開いていてもよい）へブロードキャストする、という中継構成にしている。
 *
 * background.ts / entrypoints/youtube-media.content.ts / widgets/youtube-media
 * の3箇所がこのファイルの型とメッセージ名を共有する。
 */

export const YOUTUBE_MEDIA_HOSTS = ['https://www.youtube.com/*', 'https://music.youtube.com/*'];

/** 実時間登録する content script の識別子（background.ts の registerContentScripts で使う）。 */
export const YOUTUBE_MEDIA_CONTENT_SCRIPT_ID = 'ant-youtube-media';

export type MediaSource = 'youtube' | 'youtube-music';

export interface MediaState {
  source: MediaSource;
  title: string;
  artist: string;
  /** サムネイル画像URL。取得できないこともあるので null を許容する */
  artwork: string | null;
  playing: boolean;
  /** 送信元タブのURL。同じタブかどうかの判定や、クリックでそのタブへ飛ぶ機能に使う */
  url: string;
  /** 再生位置（秒）。取得できない場合は 0 */
  currentTime: number;
  /** 動画の長さ（秒）。取得できない・ライブ配信などで不明な場合は 0 */
  duration: number;
  /**
   * content script が currentTime/duration を読み取った時刻（epoch ms）。
   * ポーリング間隔（1秒）の分の遅れを widgets/youtube-media 側で
   * `currentTime + (Date.now() - capturedAt) / 1000` として補間し、
   * シークバーが1秒ごとにカクつくのではなく滑らかに進むようにするために使う。
   */
  capturedAt: number;
}

/** content script → background: 状態が変わるたびに送る。null は「再生していない/情報なし」。 */
export interface MediaStateMessage {
  type: 'ant/media-state';
  state: MediaState | null;
}

/** background → newtab: 集約後の「今表示すべき状態」をブロードキャストする。 */
export interface MediaBroadcastMessage {
  type: 'ant/media-broadcast';
  state: MediaState | null;
}

/** newtab → background: 現在の集約状態を明示的に取りに行く（マウント直後の初期値取得用）。 */
export interface MediaGetMessage {
  type: 'ant/media-get';
}

/** newtab → background → content script: 操作コマンド。seek のときだけ time（秒）を伴う。 */
export interface MediaControlMessage {
  type: 'ant/media-control';
  action: 'playpause' | 'next' | 'previous' | 'seek';
  time?: number;
}

/** background → content script: 実際にDOM操作を行わせる。 */
export interface MediaDoMessage {
  type: 'ant/media-do';
  action: 'playpause' | 'next' | 'previous' | 'seek';
  time?: number;
}

export type MediaMessage =
  | MediaStateMessage
  | MediaBroadcastMessage
  | MediaGetMessage
  | MediaControlMessage
  | MediaDoMessage;
