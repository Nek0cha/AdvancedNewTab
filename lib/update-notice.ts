/**
 * アップデート後に新しいタブへ出す「更新されました」のお知らせ。
 *
 * background（entrypoints/background.ts）が runtime.onInstalled でアップデートを検知して
 * chrome.storage.local に印を残し、新しいタブ（components/UpdateNotice）がそれを見て表示する。
 * 閉じたら印を消すので、どのタブで閉じても他のタブからも消える（storage.onChanged）。
 *
 * アップデート時に変更内容のページを勝手に新しいタブで開く拡張機能も多いが、作業中に突然
 * タブが増えるのは邪魔になりやすい。新しいタブを開いたときに控えめに知らせるだけにしている。
 *
 * 印は PersistedState（lib/store.ts）には入れない。入れると、閉じたことが Undo の対象になったり、
 * JSON のバックアップに混ざって別の端末で同じお知らせが出たりするため。
 */

import { SITE_LINKS } from '@/lib/site-links';

export const UPDATE_NOTICE_KEY = 'updateNotice';

export interface UpdateNotice {
  /** アップデート後のバージョン（manifest の version） */
  version: string;
}

/** "0.3.1" → "0.3"。お知らせを出すかどうかは、マイナーバージョン以上が変わったかで決める。 */
function minorOf(version: string): string {
  return version.split('.').slice(0, 2).join('.');
}

/**
 * お知らせを出すべきアップデートか。
 *
 * 不具合修正だけのパッチ（0.3.0 → 0.3.1）では出さない。変更内容のページに書くほどの
 * 新しいことが無いのに毎回出すと、すぐに「読まずに閉じるもの」になってしまうため。
 * 開発中に拡張機能を再読み込みしたときも reason は 'update' になるが、バージョンが
 * 同じなのでここで除外される。
 */
export function shouldNotifyUpdate(previousVersion: string | undefined, currentVersion: string): boolean {
  if (!previousVersion) return false;
  return minorOf(previousVersion) !== minorOf(currentVersion);
}

export function parseUpdateNotice(raw: unknown): UpdateNotice | null {
  if (!raw || typeof raw !== 'object') return null;
  const { version } = raw as Partial<UpdateNotice>;
  return typeof version === 'string' ? { version } : null;
}

/** 変更内容のページ。バージョンごとの見出しに id を付けてあり、そこまで直接飛べる。 */
export function changelogUrl(version: string): string {
  return `${SITE_LINKS.changelog}#v${version}`;
}
