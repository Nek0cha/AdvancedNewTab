/**
 * ウィジェットのプラグイン契約。
 *
 * このプロジェクトの拡張性はここに集約されている。ウィジェットの追加は
 * 「widgets/<名前>/index.tsx を1つ書く」＋「registry.ts に1行足す」だけで完結し、
 * 設定画面・権限要求・追加ダイアログはすべて WidgetDef の宣言から自動的に導出される。
 */

import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * 設定フォームのフィールド宣言。
 *
 * ウィジェット側はこの配列を書くだけで、フォームのJSXは一切書かない。
 * components/SettingsPanel がこれを読んで入力欄を生成し、値の書き戻しまで行う。
 * ウィジェットを増やしても設定画面の実装コストが増えないようにするための仕組み。
 */
export type FieldSchema =
  | { kind: 'text'; key: string; label: string; placeholder?: string; help?: string }
  | { kind: 'textarea'; key: string; label: string; rows?: number; help?: string }
  | {
      kind: 'number';
      key: string;
      label: string;
      min?: number;
      max?: number;
      step?: number;
      help?: string;
    }
  | { kind: 'toggle'; key: string; label: string; help?: string }
  | {
      kind: 'select';
      key: string;
      label: string;
      options: ReadonlyArray<{ value: string; label: string }>;
      help?: string;
    }
  | { kind: 'color'; key: string; label: string; help?: string }
  /**
   * アイコン選択。値は IconValue（lib/icon-value.ts）を JSON として保持する。
   * 「未設定（既定表示に委ねる）」「lucideアイコンから選ぶ」「画像アップロード」
   * 「SVGコード貼り付け」「画像URL指定」の5系統を切り替えられる。
   */
  | { kind: 'icon'; key: string; label: string; help?: string }
  /**
   * 複数の画像をアップロードして管理するフィールド。値は dataURL の配列（string[]）。
   * ドラッグ&ドロップの並べ替えはせず、追加は末尾に足す・削除はその場で行うだけの
   * シンプルな管理に留めている（widgets/image 参照）。
   */
  | { kind: 'imageList'; key: string; label: string; help?: string }
  /** オブジェクトの配列を編集する。リンク集やRSSフィード一覧のように件数が可変のものに使う */
  | {
      kind: 'list';
      key: string;
      label: string;
      itemFields: ReadonlyArray<FieldSchema>;
      addLabel?: string;
      help?: string;
      /**
       * 「既存の項目から追加」の選択肢（例: リンク集のプリセット）。
       * 指定すると追加ボタンが「空の項目を追加」＋プリセット一覧を出す
       * ポップオーバー式に変わる。省略時は従来どおり即座に空項目を追加する。
       */
      presets?: ReadonlyArray<ListPreset>;
      /** 指定するとこの件数に達したとき追加ボタンを隠す（例: 世界時計の最大4都市）。省略時は無制限。 */
      maxItems?: number;
    };

/** FieldSchema(list) の presets に渡す1件分。 */
export interface ListPreset {
  id: string;
  label: string;
  /** プレビュー用のアイコン（省略可） */
  iconSvg?: string;
  /** 追加時にリスト項目としてそのまま挿入する値 */
  value: Record<string, unknown>;
}

/** ウィジェットに渡される props。 */
export interface WidgetProps<S> {
  /** 既定値とユーザー設定をマージ済みの設定値 */
  settings: S;
  /** 配置されたウィジェット固有のID。設定の書き戻しに使う */
  instanceId: string;
  /** 編集モード中かどうか。編集中は内部の操作を無効にしたいウィジェットが参照する */
  editMode: boolean;
}

export interface WidgetDef<S extends Record<string, unknown> = Record<string, unknown>> {
  /** レジストリの引き当てキー。永続化データに残るため、一度決めたら変更しない */
  type: string;
  /** 追加ダイアログとウィジェットのヘッダに出る表示名 */
  name: string;
  /** 追加ダイアログに出る一行説明 */
  description: string;
  /** lucide-react のアイコンコンポーネント */
  icon: LucideIcon;
  /** 追加時の初期サイズと最小サイズ（グリッド単位） */
  defaultLayout: { w: number; h: number; minW: number; minH: number };
  /**
   * 枠の見せ方。
   * - 'card' : 半透明のカード面を敷く（既定）
   * - 'bare' : 背景を持たず中身だけを見せる。時計や検索ボックスなど、
   *            枠があるとかえって浮いてしまうものに使う
   * 編集モード中は 'bare' でも掴めるように破線の枠が出る。
   */
  frame?: 'card' | 'bare';
  /**
   * このウィジェットが必要とする権限。
   * 配置した瞬間に lib/permissions.ts がまとめて要求する。
   */
  permissions?: {
    chrome?: readonly string[];
    hosts?: readonly string[];
  };
  defaultSettings: S;
  settingsSchema: ReadonlyArray<FieldSchema>;
  Component: ComponentType<WidgetProps<S>>;
}

/** レジストリへ格納する際の型消去済みの形。 */
export type AnyWidgetDef = WidgetDef<Record<string, unknown>>;

/**
 * 型推論を効かせたままウィジェットを定義するためのヘルパー。
 * 実処理はなく、S を defaultSettings から推論させることだけが目的。
 */
export function defineWidget<S extends Record<string, unknown>>(def: WidgetDef<S>): WidgetDef<S> {
  return def;
}
