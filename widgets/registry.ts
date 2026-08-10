/**
 * ウィジェットの登録簿。
 *
 * ウィジェットを追加するときに触るのはこのファイルの import と register の2行だけでよい。
 * 追加ダイアログ・設定フォーム・必要権限の要求は、すべてここに登録された
 * WidgetDef の宣言から自動的に導出される。
 */

import { bookmarksWidget } from '@/widgets/bookmarks';
import { calculatorWidget } from '@/widgets/calculator';
import { calendarWidget } from '@/widgets/calendar';
import { clockWidget } from '@/widgets/clock';
import { countdownWidget } from '@/widgets/countdown';
import { imageWidget } from '@/widgets/image';
import { linksWidget } from '@/widgets/links';
import { memoWidget } from '@/widgets/memo';
import { pomodoroWidget } from '@/widgets/pomodoro';
import { rssWidget } from '@/widgets/rss';
import { searchWidget } from '@/widgets/search';
import { topSitesWidget } from '@/widgets/topsites';
import { weatherWidget } from '@/widgets/weather';
import { worldClockWidget } from '@/widgets/worldclock';
import { youtubeMediaWidget } from '@/widgets/youtube-media';
import type { AnyWidgetDef, WidgetDef } from '@/widgets/types';

const registry = new Map<string, AnyWidgetDef>();

/**
 * 登録時にだけ型を消す。
 * 各ウィジェットは自分の設定型で書けて、レジストリ側は一様に扱えるようにするための橋渡し。
 */
function register<S extends Record<string, unknown>>(def: WidgetDef<S>): void {
  registry.set(def.type, def as unknown as AnyWidgetDef);
}

register(clockWidget);
register(searchWidget);
register(linksWidget);
register(memoWidget);
register(topSitesWidget);
register(bookmarksWidget);
register(weatherWidget);
register(rssWidget);
register(youtubeMediaWidget);
register(calendarWidget);
register(countdownWidget);
register(pomodoroWidget);
register(calculatorWidget);
register(imageWidget);
register(worldClockWidget);

/** 種類名から定義を引く。未知の種類（拡張のダウングレード後など）では undefined を返す。 */
export function getWidgetDef(type: string): AnyWidgetDef | undefined {
  return registry.get(type);
}

/** 追加ダイアログに並べる一覧。登録順を保つ。 */
export function listWidgetDefs(): AnyWidgetDef[] {
  return [...registry.values()];
}
