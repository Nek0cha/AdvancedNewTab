/**
 * 状態の読み書きとマイグレーションを引き受ける層。
 *
 * 拡張機能ビルドでは chrome.storage.local を使う。chrome.storage.sync は使用していない。
 * 合計100KB / 1項目8KB の制限にレイアウトJSONと背景画像が収まらないためで、端末間の移行は
 * options ページの JSON エクスポート/インポートで代替する。
 *
 * 壁紙・スタートページ用途の静的サイト版（entrypoints/webapp、`npm run build:web`）には
 * chrome.storage が存在しないため、`isExtensionContext()`（lib/platform.ts）で分岐し、
 * 同じ関数シグネチャのまま localStorage ベースの代替実装に切り替える。normalize/migrateRaw は
 * 保存先に依存しない純粋な変換なので、どちらの実装からも共通で使い回す。
 */

import { isExtensionContext } from '@/lib/platform';
import { DEFAULT_FONT_ID } from '@/lib/fonts';
import { SCHEMA_VERSION, createDefaultState } from '@/lib/defaults';
import type { PersistedState } from '@/lib/types';

/**
 * 初回起動（ストレージに何も無い状態）にだけ使う、カスタムの既定レイアウト。
 *
 * 中身が null の間は何もせず、lib/defaults.ts の createDefaultState()（ハードコードされた
 * 最小構成）がこれまでどおり使われる。差し替えたい場合は、options ページの
 * 「JSONをダウンロード」でエクスポートした内容をこのファイルにそのまま貼り付ける
 * （version・rev はそのままでよい。normalize() を通すため、多少スキーマが古くても
 * 自動的に補正・移行される）。
 *
 * createDefaultState() 自体は書き換えない — normalize() が「壊れた/読めない保存データ」を
 * 復旧するときの最終フォールバックとしても使われているため、常にハードコードされた
 * 安全な既定値のまま残しておく必要がある（このJSONの中身がもし壊れていても、
 * normalize() が結局 createDefaultState() まで遡って復旧できるようにするため）。
 */
import defaultStateOverride from '@/lib/default-state.json';

const STATE_KEY = 'state';
/** 静的サイト版が使う localStorage のキー。拡張機能版の STATE_KEY とは別名前空間にしておく。 */
const WEB_STORAGE_KEY = 'ant:web-state';

/** 保存の書き込み間隔（ms）。ドラッグ中の onLayoutChange 連打を吸収する。 */
const WRITE_DEBOUNCE_MS = 400;

/**
 * 旧スキーマの生JSONを現行の形へ変換する。
 *
 * normalize() の単純なオブジェクトマージでは、background のようにネストした
 * 構造が丸ごと別形式に変わったフィールドを安全に統合できない
 * （旧形式のオブジェクトがそのまま上書きされ、`.active` 等が欠けた壊れた値になる）。
 * そのため生データの構造変換はここで正規化より先に行う。
 *
 * バージョンを上げる際は、対応する if ブロックを追加すること。
 */
function migrateRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = raw as Record<string, unknown>;
  const version = typeof obj.version === 'number' ? obj.version : 0;

  let theme = obj.theme as Record<string, unknown> | undefined;

  // v1 → v2: background がユニオン型（type: 'solid'|'gradient'|'image'）から
  // 3方式を同時保持する形へ変更。fontFamily(文字列) が canvasFontId(id参照) に変更。
  // cardBorderWidth / tabTitle / customFont を新設。
  if (version < 2 && theme) {
    const bg = theme.background as Record<string, unknown> | undefined;
    if (bg && typeof bg.type === 'string') {
      const fallbackSolid = { color: '#11141b' };
      const fallbackGradient = { from: '#241a2e', to: '#0c0d14', angle: 155 };
      const fallbackImage = { src: '', fallbackColor: '#11141b', blur: 0, dim: 0.15 };

      theme = {
        ...theme,
        background: {
          active: bg.type,
          solid: bg.type === 'solid' ? { color: bg.color } : fallbackSolid,
          gradient:
            bg.type === 'gradient'
              ? { from: bg.from, to: bg.to, angle: bg.angle }
              : fallbackGradient,
          image:
            bg.type === 'image'
              ? {
                  src: bg.src,
                  fallbackColor: bg.fallbackColor,
                  blur: bg.blur,
                  dim: bg.dim,
                }
              : fallbackImage,
        },
      };
    }

    if (typeof theme.fontFamily === 'string') {
      const { fontFamily: _fontFamily, ...rest } = theme;
      theme = { ...rest, canvasFontId: DEFAULT_FONT_ID, customFont: null };
    }

    theme = { cardBorderWidth: 1, tabTitle: '新しいタブ', customFont: null, ...theme };
  }

  // v2 → v3: ライトモードを廃止し常時ダーク化。mode は型ごと削除したため、
  // 残っていても単に無視されるだけで実害は無いが、亡霊のように残り続けないよう
  // 明示的に取り除いておく。
  if (version < 3 && theme && 'mode' in theme) {
    const { mode: _mode, ...rest } = theme;
    theme = rest;
  }

  return theme ? { ...obj, version: SCHEMA_VERSION, theme } : obj;
}

/**
 * 読み込んだ値をアプリが期待する形に整える。
 *
 * ユーザーが手でJSONをインポートしたり、storage が壊れたりしても
 * 画面が真っ白にならないよう、欠けたキーは既定値で埋める。
 */
function normalize(raw: unknown): PersistedState {
  const fallback = createDefaultState();
  const migrated = migrateRaw(raw);
  if (!migrated || typeof migrated !== 'object') return fallback;

  const value = migrated as Partial<PersistedState>;
  const theme = value.theme ?? {};
  return {
    version: SCHEMA_VERSION,
    theme: {
      ...fallback.theme,
      ...theme,
      background: { ...fallback.theme.background, ...(theme as Partial<typeof fallback.theme>).background },
    },
    layouts: value.layouts && typeof value.layouts === 'object' ? value.layouts : fallback.layouts,
    widgets: value.widgets && typeof value.widgets === 'object' ? value.widgets : fallback.widgets,
    // 旧データ（rev導入前）やインポートされたJSONには無いことがあるので0にフォールバックする。
    // インポート直後の版数を0から数え直すだけで、自己書き込みガードの正しさには影響しない
    // （store.ts 側は「今のセッションで自分がどこまで進めたか」だけを見ているため）。
    rev: typeof value.rev === 'number' ? value.rev : 0,
    toolbarPosition:
      value.toolbarPosition &&
      typeof value.toolbarPosition === 'object' &&
      typeof value.toolbarPosition.x === 'number' &&
      typeof value.toolbarPosition.y === 'number'
        ? value.toolbarPosition
        : null,
    // 常にちょうど3枠になるよう、欠けていればnullで埋め、多ければ切り詰める
    // （MAX_LAYOUT_PRESETS を変更した場合もこの正規化だけで追従する）。
    layoutPresets: Array.from(
      { length: fallback.layoutPresets.length },
      (_, i) => (Array.isArray(value.layoutPresets) ? (value.layoutPresets[i] ?? null) : null),
    ),
  };
}

/**
 * インポートされたJSONを検証・移行して安全な PersistedState に変換する。
 * options ページのインポート機能から使う（通常の読み込みと同じ経路を通すことで、
 * 壊れたデータへの耐性を揃えている）。
 */
export function parseImportedState(raw: unknown): PersistedState {
  return normalize(raw);
}

export async function loadState(): Promise<PersistedState> {
  try {
    if (!isExtensionContext()) {
      const raw = localStorage.getItem(WEB_STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
      // 保存済みデータが無い＝初回訪問のときだけ、カスタム既定レイアウトの出番
      return normalize(defaultStateOverride ?? undefined);
    }
    const stored = await browser.storage.local.get(STATE_KEY);
    if (stored[STATE_KEY] !== undefined) return normalize(stored[STATE_KEY]);
    // 保存済みデータが無い＝初回起動のときだけ、カスタム既定レイアウトの出番
    return normalize(defaultStateOverride ?? undefined);
  } catch (error) {
    console.error('[AdvancedNewTab] 設定の読み込みに失敗したため既定値で起動します', error);
    return createDefaultState();
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  if (!isExtensionContext()) {
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(state));
    return;
  }
  await browser.storage.local.set({ [STATE_KEY]: state });
}

/**
 * 書き込みをまとめるための遅延保存。
 * 直近の呼び出しだけが実際に書き込まれる。
 */
export function createDebouncedSaver(): (state: PersistedState) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: PersistedState | undefined;

  return (state: PersistedState) => {
    pending = state;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      const target = pending;
      pending = undefined;
      if (target) {
        void saveState(target).catch((error) =>
          console.error('[AdvancedNewTab] 設定の保存に失敗しました', error),
        );
      }
    }, WRITE_DEBOUNCE_MS);
  };
}

/** 他のタブ／options ページでの変更を購読する。解除用の関数を返す。 */
export function subscribeExternalChanges(onChange: (state: PersistedState) => void): () => void {
  if (!isExtensionContext()) {
    // localStorage の 'storage' イベントはブラウザ標準で「別タブ・別ウィンドウでの変更」の
    // ときだけ発火する（変更した本人のタブでは発火しない）ため、chrome.storage.onChanged と
    // 同じ「自分以外の変更を検知する」用途にそのまま使える。
    const listener = (event: StorageEvent): void => {
      if (event.key !== WEB_STORAGE_KEY || event.newValue === null) return;
      try {
        onChange(normalize(JSON.parse(event.newValue)));
      } catch (error) {
        console.error('[AdvancedNewTab] 他タブからの変更の読み取りに失敗しました', error);
      }
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }

  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    areaName: string,
  ): void => {
    if (areaName !== 'local') return;
    const change = changes[STATE_KEY];
    if (!change || change.newValue === undefined) return;
    onChange(normalize(change.newValue));
  };

  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
