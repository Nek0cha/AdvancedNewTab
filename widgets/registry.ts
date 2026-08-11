/**
 * ウィジェットの登録簿。
 *
 * ウィジェットを追加するときに触るのはこのファイルの import と register の2行だけでよい。
 * 追加ダイアログ・設定フォーム・必要権限の要求は、すべてここに登録された
 * WidgetDef の宣言から自動的に導出される。
 */

import { WIDGET_BACKGROUND_DEFAULTS, widgetBackgroundFields } from '@/lib/widget-background';
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
 *
 * ここで「個別スタイル」（lib/widget-background.ts）と「サイズ変更時の自動非表示」
 * （components/WidgetFrame/WidgetFrame.tsx）の設定項目を全ウィジェットへ一括で注入する。
 * 各ウィジェットファイル側で defaultSettings/settingsSchema に個別にスプレッドする
 * 必要がないため、「ファイル1つ + register 1行」という拡張性を崩さずに済む。
 * ここに置いているのは widgets/types.ts との循環import（widgets/types.ts が
 * lib/widget-background.ts の値をimportし、そちらは widgets/types.ts の型をimportする）を
 * 避けるため。
 */
function register<S extends Record<string, unknown>>(def: WidgetDef<S>): void {
  // 時計・検索は既定で常に見えていてほしいため、リサイズ時の自動非表示は既定OFF。
  // それ以外は既定ONで、崩れて見えやすい狭い画面・リサイズ中だけ自動的に隠れる。
  const hideOnResizeDefault = def.type !== 'clock' && def.type !== 'search';
  // 検索は個別背景を検索バーの<form>だけに適用する都合上、枠線フィールドは出さない
  // （widgets/search/index.tsx が backgroundScope:'self' で自前適用する際の前提）。
  const includeBorder = def.type !== 'search';

  const augmented: AnyWidgetDef = {
    ...def,
    defaultSettings: {
      ...WIDGET_BACKGROUND_DEFAULTS,
      hideOnResize: hideOnResizeDefault,
      ...def.defaultSettings,
    },
    settingsSchema: [
      ...def.settingsSchema,
      ...widgetBackgroundFields({ border: includeBorder }),
      { kind: 'toggle', key: 'hideOnResize', label: 'ウィンドウサイズ変更時に自動で非表示にする' },
    ],
  } as unknown as AnyWidgetDef;

  registry.set(def.type, augmented);
}

register(clockWidget);
register(searchWidget);
register(linksWidget);
register(memoWidget);
register(calendarWidget);
register(countdownWidget);
register(pomodoroWidget);
register(calculatorWidget);
register(imageWidget);
register(worldClockWidget);
register(weatherWidget);

/**
 * ブラウザ拡張機能APIに依存し、静的サイト版（entrypoints/webapp、`npm run build:web`）では
 * 動作しないウィジェット。vite.web.config.ts が `import.meta.env.VITE_TARGET` を `'web'` に
 * 設定してビルドするときだけ登録をスキップする。これにより追加ダイアログに出ないだけでなく、
 * `browser.*` に触れるこれらのファイル自体がWebバンドルからツリーシェイクされる。
 * 通常の拡張機能ビルド（wxt build）では import.meta.env.VITE_TARGET が未設定のため、
 * これまでどおり全ウィジェットが登録される。
 */
if (import.meta.env.VITE_TARGET !== 'web') {
  register(topSitesWidget);
  register(bookmarksWidget);
  register(rssWidget);
  register(youtubeMediaWidget);
}

/** 種類名から定義を引く。未知の種類（拡張のダウングレード後など）では undefined を返す。 */
export function getWidgetDef(type: string): AnyWidgetDef | undefined {
  return registry.get(type);
}

/** 追加ダイアログに並べる一覧。登録順を保つ。 */
export function listWidgetDefs(): AnyWidgetDef[] {
  return [...registry.values()];
}
