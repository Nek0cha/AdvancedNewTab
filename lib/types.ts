/**
 * アプリ全体で共有する永続化データの型定義。
 *
 * レイアウト（配置情報）とウィジェット設定を意図的に分離している。
 * 前者は react-grid-layout がそのまま解釈できる形、後者はアプリ側の管理下に置くことで、
 * 将来グリッドライブラリを差し替える際の影響範囲を layouts に閉じ込める。
 */

import type { Layout } from 'react-grid-layout';

/** ブレークポイント名。react-grid-layout の既定値に合わせている。 */
export type BreakpointName = 'lg' | 'md' | 'sm' | 'xs';

export const BREAKPOINTS: Record<BreakpointName, number> = {
  lg: 1400,
  md: 1000,
  sm: 700,
  xs: 0,
};

export const COLS: Record<BreakpointName, number> = {
  lg: 12,
  md: 10,
  sm: 6,
  xs: 4,
};

export const BREAKPOINT_NAMES: BreakpointName[] = ['lg', 'md', 'sm', 'xs'];

/**
 * 背景の3方式（単色・グラデーション・画像）を「同時に保持」する形にしている。
 *
 * 以前は type によるユニオン型で1方式分の値しか持てず、単色→画像→単色と
 * 切り替えるたびに前の設定が失われるバグがあった（v1のBackgroundConfig）。
 * 3方式すべての値を常に保持し、`active` でどれを使うかだけを切り替えることで、
 * 「行ったり来たり」しても直前の内容が残るようにしている。
 */
export interface BackgroundConfig {
  active: 'solid' | 'gradient' | 'image';
  solid: { color: string };
  gradient: { from: string; to: string; angle: number };
  image: {
    /** dataURL（ローカルアップロード）または外部URL */
    src: string;
    /** 画像が読めなかった場合と初回ペイント時に使う下地の色 */
    fallbackColor: string;
    /** 背景のぼかし（px） */
    blur: number;
    /** 背景を暗くする度合い（0〜1） */
    dim: number;
  };
}

/** ユーザーがアップロードしたカスタムフォント。背景画像と同様 dataURL で保持する。 */
export interface CustomFont {
  /** @font-face の font-family に使う内部名（衝突を避けるため固定プレフィックス付き） */
  familyName: string;
  /** 表示用の元ファイル名 */
  originalFileName: string;
  dataUrl: string;
  /** src() の format() 引数（'woff2' | 'woff' | 'truetype' | 'opentype'） */
  format: string;
}

export interface ThemeConfig {
  /** ライト/ダーク。CSS側は [data-theme] で分岐する */
  mode: 'dark' | 'light';
  background: BackgroundConfig;
  /** 文字色 */
  textColor: string;
  /** アクセント色（リンク・フォーカスリングなど） */
  accentColor: string;
  /** widgets/lib/fonts.ts の FontOption.id、または 'custom' */
  canvasFontId: string;
  /** canvasFontId === 'custom' のときに使う */
  customFont: CustomFont | null;
  /** ウィジェットカードの背景色（不透明度は cardOpacity で別管理） */
  cardColor: string;
  /** ウィジェットカードの背景不透明度（0〜1） */
  cardOpacity: number;
  /** ウィジェットカードの背面ぼかし（px）。0 で無効 */
  cardBlur: number;
  /** ウィジェットカードの角丸（px） */
  cardRadius: number;
  /** ウィジェットカードの枠線太さ（px）。0 で枠線なし */
  cardBorderWidth: number;
  /** グリッド1行の高さ（px） */
  rowHeight: number;
  /** ウィジェット間の余白（px） */
  gridMargin: number;
  /**
   * 配置の詰め方。
   * - 'none'     : 完全自由配置。置いた場所にそのまま残る
   * - 'vertical' : 上方向へ自動的に詰める（一般的なダッシュボードの挙動）
   */
  gridCompact: 'none' | 'vertical';
  /** ブラウザタブに表示されるページタイトル */
  tabTitle: string;
}

/** 配置されたウィジェット1個の実体。設定の中身は各ウィジェット定義が決める。 */
export interface WidgetInstance {
  /** WidgetDef.type と対応。レジストリの引き当てに使う */
  type: string;
  /** ウィジェット固有の設定値 */
  settings: Record<string, unknown>;
}

/** レイアウト保存機能（最大3枠）の1件分。テーマは含まず、配置とウィジェット構成だけを保存する。 */
export interface LayoutPreset {
  name: string;
  savedAt: number;
  layouts: Partial<Record<BreakpointName, Layout>>;
  widgets: Record<string, WidgetInstance>;
}

/** レイアウト保存の最大枠数。 */
export const MAX_LAYOUT_PRESETS = 3;

export interface PersistedState {
  /** マイグレーション用のスキーマバージョン */
  version: number;
  theme: ThemeConfig;
  /** ブレークポイントごとの配置情報 */
  layouts: Partial<Record<BreakpointName, Layout>>;
  /** instanceId → ウィジェット実体 */
  widgets: Record<string, WidgetInstance>;
  /**
   * Toolbar（右上の編集/追加/見た目メニュー）のドラッグ移動後の位置。
   * null なら既定位置（右上）に固定表示する。components/Toolbar/Toolbar.tsx 参照。
   */
  toolbarPosition: { x: number; y: number } | null;
  /** レイアウト保存の3枠。未使用のスロットは null。 */
  layoutPresets: Array<LayoutPreset | null>;
  /**
   * ローカルでの変更回数（commit() のたびに +1）。
   *
   * lib/store.ts の自己書き込みガードに使う。`chrome.storage.onChanged` は非同期に
   * 発火するため、直近の書き込み内容と単純に文字列比較するだけでは、
   * 「短い間隔で複数回編集した」場合に古い書き込みのエコーが後から届いて
   * 新しい変更を上書きしてしまうことがあった（詳細は store.ts のコメント参照）。
   * 単調増加する版数で比較することで、届いた変更が自分の書き込みより
   * 古いか新しいかを常に正しく判定できる。
   */
  rev: number;
}

/**
 * 初回ペイント用に localStorage へミラーする最小限の値。
 * chrome.storage.local が非同期なので、同期APIで読める場所に別途持たせている。
 * （public/boot.js が読む。キー名を変える場合は boot.js も合わせること）
 */
export interface BootTheme {
  mode: 'dark' | 'light';
  /** html要素に流し込む background ショートハンドの値 */
  background: string;
  color: string;
}

export const BOOT_THEME_KEY = 'ant:boot-theme';
