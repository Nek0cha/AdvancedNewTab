/**
 * アプリ状態のシングルストア（Zustand）。
 *
 * 設定値はほぼ全ウィジェットから参照されるため、Context + useReducer では
 * 再レンダリング範囲の制御が煩雑になる。セレクタ単位で購読できる Zustand を採用している。
 *
 * 永続化はこの層が一手に引き受ける。ミューテーションのたびに遅延保存へ積み、
 * 他タブからの変更は subscribeExternalChanges 経由で取り込む。
 */

import type { Layout, LayoutItem } from 'react-grid-layout';
import { create } from 'zustand';

import { createDefaultState } from '@/lib/defaults';
import { findFirstFitPosition } from '@/lib/grid-collision';
import { computeGridMetrics } from '@/lib/grid-metrics';
import {
  createDebouncedSaver,
  loadState,
  subscribeExternalChanges,
} from '@/lib/storage';
import { applyTheme } from '@/lib/theme';
import {
  BREAKPOINT_NAMES,
  COLS,
  MAX_LAYOUT_PRESETS,
  type BreakpointName,
  type LayoutPreset,
  type PersistedState,
  type ThemeConfig,
  type WidgetInstance,
} from '@/lib/types';

const save = createDebouncedSaver();

/**
 * 自分が書いた内容が storage.onChanged で返ってきたときに再適用してしまうのを防ぐ。
 *
 * 以前は「直近に書き出した内容のシリアライズ」を1つだけ覚えておき、一致したら無視する
 * 方式だった。これは次の順序で壊れる:
 *   1. commit(A) → lastSerialized = A、保存を400msデバウンスで予約
 *   2. 400ms以内に commit(B) → lastSerialized = B、予約をBに差し替え
 *   3. デバウンスが発火し saveState(B) が実際に書き込まれる
 *   4. さらにすぐ commit(C) → lastSerialized = C
 *   5. ここで手順3の書き込みに対する chrome.storage.onChanged(B) が非同期に届く
 *      （実ブラウザでは書き込みからイベント到着まで確実に遅延がある）
 *   6. JSON.stringify(B) !== lastSerialized(C) → 「外部からの変更」と誤判定し、
 *      Bで上書きしてしまう＝直前の編集Cが一瞬で消える
 * これが「ボタン/タブ/文字入力が一瞬前の状態に戻る」バグの正体だった
 * （短い間隔で複数回操作したときだけ起きるため、実機でしか再現しづらかった）。
 *
 * 単調増加する版数（PersistedState.rev）で比較する方式に直すことで、
 * 「届いた変更が自分がローカルで既に進めた地点より古いかどうか」を
 * 非同期の到着順序に関係なく正しく判定できるようにしている。
 */
let highestLocalRev = 0;

/**
 * 元に戻す/やり直す（Undo/Redo）用の履歴。
 *
 * commit() が全ミューテーションの唯一の経路であることを利用し、ここに履歴の出し入れを
 * 一括で足す。テキスト入力欄はキー入力のたびに commit() されるため、そのまま1回ごとに
 * 履歴を積むと「あ」「あい」「あいう」…と1文字ごとにUndoが必要になってしまう。
 * 短い間隔（COALESCE_MS）の連続した commit() は1つの履歴ステップにまとめる
 * （storage への書き込みを 400ms デバウンスしているのと同じ発想だが、目的が違うので別物）。
 */
const MAX_HISTORY = 50;
const COALESCE_MS = 800;
let past: PersistedState[] = [];
let future: PersistedState[] = [];
/** 現在まとめている最中の編集バーストの「開始時点」の状態。null なら何も保留していない。 */
let coalesceBaseline: PersistedState | null = null;
let coalesceTimer: ReturnType<typeof setTimeout> | undefined;

/** 保留中の編集バーストを確定させ、履歴（past）へ実際に積む。 */
function flushCoalesce(): void {
  if (coalesceTimer !== undefined) {
    clearTimeout(coalesceTimer);
    coalesceTimer = undefined;
  }
  if (coalesceBaseline) {
    past.push(coalesceBaseline);
    if (past.length > MAX_HISTORY) past.shift();
    coalesceBaseline = null;
  }
}

/** 他タブ由来の変更などで、ローカルのUndo/Redo履歴を丸ごと無効化する。 */
function resetHistory(): void {
  if (coalesceTimer !== undefined) clearTimeout(coalesceTimer);
  coalesceTimer = undefined;
  coalesceBaseline = null;
  past = [];
  future = [];
}

/** 右側サイドパネルに何を出しているか。 */
export type PanelState =
  | null
  | { kind: 'add' }
  | { kind: 'widget'; instanceId: string }
  | { kind: 'theme' };

interface AppStore {
  /** storage からの初回読み込みが完了したか */
  ready: boolean;
  /** 編集モード（ドラッグ・リサイズ・削除ボタンの表示） */
  editMode: boolean;
  /** 右側サイドパネルの表示内容。null なら閉じている */
  panel: PanelState;
  state: PersistedState;
  /** ツールバーのUndo/Redoボタンの活性状態。lib/store.ts 内の履歴（past/future）を反映する。 */
  canUndo: boolean;
  canRedo: boolean;

  init: () => Promise<void>;
  setEditMode: (value: boolean) => void;
  openPanel: (panel: NonNullable<PanelState>) => void;
  closePanel: () => void;
  patchTheme: (patch: Partial<ThemeConfig>) => void;
  setLayouts: (layouts: Partial<Record<BreakpointName, Layout>>) => void;
  addWidget: (spec: {
    type: string;
    defaultSettings: Record<string, unknown>;
    defaultLayout: Pick<LayoutItem, 'w' | 'h' | 'minW' | 'minH'>;
  }) => string;
  removeWidget: (instanceId: string) => void;
  /** 同じ種類・設定のウィジェットをもう1つ、空いている場所に複製する */
  duplicateWidget: (instanceId: string) => void;
  patchWidgetSettings: (instanceId: string, patch: Record<string, unknown>) => void;
  /**
   * 全ブレークポイントで、指定ウィジェットの x を `round((cols - w) / 2)` に揃える。
   * react-grid-layout の座標は整数のグリッド単位なので、ドラッグでは
   * 「あと半マス」がどうしても合わせられないことがある（w と cols の差が奇数のとき）。
   * 数値で直接計算して置き直すことで、ドラッグの手数に頼らず正確な中央寄せができる。
   */
  centerWidgetHorizontally: (instanceId: string) => void;
  /** Toolbar のドラッグ移動後の位置を保存する。null で既定位置（右上）へ戻す。 */
  setToolbarPosition: (position: { x: number; y: number } | null) => void;
  /** 現在のレイアウト+ウィジェット構成を指定スロット（0〜MAX_LAYOUT_PRESETS-1）に保存する */
  saveLayoutPreset: (slot: number, name: string) => void;
  /** 指定スロットの保存内容で、現在のレイアウト+ウィジェット構成を置き換える */
  loadLayoutPreset: (slot: number) => void;
  /** 指定スロットを空にする */
  deleteLayoutPreset: (slot: number) => void;
  /** インポート・初期化用に状態を丸ごと差し替える */
  replaceState: (next: PersistedState) => void;
  /** 直前の変更を1ステップ取り消す。取り消せる変更が無ければ何もしない。 */
  undo: () => void;
  /** undo() で取り消した変更をやり直す。やり直せる変更が無ければ何もしない。 */
  redo: () => void;
}

export const useAppStore = create<AppStore>((set, get) => {
  /**
   * 状態を更新し、テーマ適用と永続化まで面倒を見る共通経路。
   * `opts.history` を明示的に false にした呼び出し（undo/redo自身）だけは履歴を積まない
   * （さもないと undo するたびに「undo したこと」自体が新たな履歴になり、
   * 何度押しても同じ2状態を行き来するだけになってしまう）。
   */
  const commit = (next: PersistedState, opts?: { history?: boolean }): void => {
    const recordHistory = opts?.history !== false;
    if (recordHistory) {
      if (!coalesceBaseline) coalesceBaseline = get().state;
      future = [];
      if (coalesceTimer !== undefined) clearTimeout(coalesceTimer);
      coalesceTimer = setTimeout(flushCoalesce, COALESCE_MS);
    }

    const withRev = { ...next, rev: highestLocalRev + 1 };
    highestLocalRev = withRev.rev;
    applyTheme(withRev.theme);
    set({
      state: withRev,
      canUndo: past.length > 0 || coalesceBaseline !== null,
      canRedo: future.length > 0,
    });
    save(withRev);
  };

  return {
    ready: false,
    editMode: false,
    panel: null,
    state: createDefaultState(),
    canUndo: false,
    canRedo: false,

    init: async () => {
      const loaded = await loadState();
      highestLocalRev = loaded.rev;
      applyTheme(loaded.theme);
      set({ state: loaded, ready: true });

      subscribeExternalChanges((external) => {
        // 自分の書き込みのエコー（もしくはそれより古い遅延到着）なら何もしない。
        // コメント（highestLocalRev の定義）参照。
        if (external.rev <= highestLocalRev) return;
        highestLocalRev = external.rev;
        applyTheme(external.theme);
        // 他タブ由来の状態ジャンプを起点にした undo/redo は一貫性が保てないため、
        // ローカルの履歴は丸ごと無効化する。
        resetHistory();
        set({ state: external, canUndo: false, canRedo: false });
      });
    },

    // 編集モードを抜けるときはパネルも畳む。編集用のパネルだけが残る状態を作らないため。
    setEditMode: (value) => set(value ? { editMode: true } : { editMode: false, panel: null }),

    openPanel: (panel) => set({ panel }),

    closePanel: () => set({ panel: null }),

    patchTheme: (patch) => {
      const current = get().state;
      commit({ ...current, theme: { ...current.theme, ...patch } });
    },

    setLayouts: (layouts) => {
      const current = get().state;
      commit({ ...current, layouts });
    },

    addWidget: ({ type, defaultSettings, defaultLayout }) => {
      const current = get().state;
      const instanceId = `${type}-${Date.now().toString(36)}`;

      // maxRows（1画面ぶんの行数）は本来 Grid.tsx が実測値から出すものだが、
      // ここではウィンドウの高さから概算する（lib/grid-metrics.ts で計算式を共有）。
      // 多少のズレがあっても実害は小さい（first-fit が範囲内に置き場所を見つけられなければ
      // 範囲外にフォールバックするだけで、置けなくなるわけではない）。
      const { maxRows } = computeGridMetrics(window.innerHeight, current.theme.rowHeight, current.theme.gridMargin);

      const layouts: Partial<Record<BreakpointName, Layout>> = { ...current.layouts };
      for (const bp of BREAKPOINT_NAMES) {
        const existing = current.layouts[bp] ?? [];
        const { x, y } = findFirstFitPosition(existing, COLS[bp], defaultLayout.w, defaultLayout.h, maxRows);
        layouts[bp] = [...existing, { i: instanceId, x, y, ...defaultLayout }];
      }

      const widget: WidgetInstance = { type, settings: { ...defaultSettings } };
      commit({
        ...current,
        layouts,
        widgets: { ...current.widgets, [instanceId]: widget },
      });
      return instanceId;
    },

    removeWidget: (instanceId) => {
      const current = get().state;
      const layouts: Partial<Record<BreakpointName, Layout>> = {};
      for (const bp of BREAKPOINT_NAMES) {
        layouts[bp] = (current.layouts[bp] ?? []).filter((item) => item.i !== instanceId);
      }
      const widgets = { ...current.widgets };
      delete widgets[instanceId];
      commit({ ...current, layouts, widgets });

      // 削除したウィジェットの設定パネルが開いたままにならないようにする
      const panel = get().panel;
      if (panel?.kind === 'widget' && panel.instanceId === instanceId) set({ panel: null });
    },

    duplicateWidget: (instanceId) => {
      const current = get().state;
      const source = current.widgets[instanceId];
      if (!source) return;

      const newId = `${source.type}-${Date.now().toString(36)}`;
      const { maxRows } = computeGridMetrics(window.innerHeight, current.theme.rowHeight, current.theme.gridMargin);

      const layouts: Partial<Record<BreakpointName, Layout>> = { ...current.layouts };
      for (const bp of BREAKPOINT_NAMES) {
        const existing = current.layouts[bp] ?? [];
        const sourceItem = existing.find((item) => item.i === instanceId);
        // 元のブレークポイントにその時点で存在しない（レスポンシブでまだ生成されていない）
        // 場合は、単純に最初に見つかった配置のサイズを流用する。
        const { w, h, minW, minH, maxW, maxH } = sourceItem ?? existing[0] ?? { w: 4, h: 2 };
        const { x, y } = findFirstFitPosition(existing, COLS[bp], w, h, maxRows);
        layouts[bp] = [...existing, { i: newId, x, y, w, h, minW, minH, maxW, maxH }];
      }

      commit({
        ...current,
        layouts,
        widgets: { ...current.widgets, [newId]: { type: source.type, settings: { ...source.settings } } },
      });
    },

    patchWidgetSettings: (instanceId, patch) => {
      const current = get().state;
      const target = current.widgets[instanceId];
      if (!target) return;
      commit({
        ...current,
        widgets: {
          ...current.widgets,
          [instanceId]: { ...target, settings: { ...target.settings, ...patch } },
        },
      });
    },

    centerWidgetHorizontally: (instanceId) => {
      const current = get().state;
      const layouts: Partial<Record<BreakpointName, Layout>> = {};
      for (const bp of BREAKPOINT_NAMES) {
        const existing = current.layouts[bp];
        if (!existing) continue;
        layouts[bp] = existing.map((item) => {
          if (item.i !== instanceId) return item;
          const cols = COLS[bp];
          const x = Math.max(0, Math.round((cols - item.w) / 2));
          return { ...item, x };
        });
      }
      commit({ ...current, layouts: { ...current.layouts, ...layouts } });
    },

    setToolbarPosition: (position) => {
      const current = get().state;
      commit({ ...current, toolbarPosition: position });
    },

    saveLayoutPreset: (slot, name) => {
      const current = get().state;
      if (slot < 0 || slot >= MAX_LAYOUT_PRESETS) return;
      const preset: LayoutPreset = {
        name,
        savedAt: Date.now(),
        layouts: current.layouts,
        widgets: current.widgets,
        theme: current.theme,
      };
      const layoutPresets = [...current.layoutPresets];
      layoutPresets[slot] = preset;
      commit({ ...current, layoutPresets });
    },

    loadLayoutPreset: (slot) => {
      const current = get().state;
      const preset = current.layoutPresets[slot];
      if (!preset) return;
      // preset.theme は本機能追加前に保存された枠には存在しない。その場合は今のテーマを維持する。
      commit({ ...current, layouts: preset.layouts, widgets: preset.widgets, theme: preset.theme ?? current.theme });
    },

    deleteLayoutPreset: (slot) => {
      const current = get().state;
      if (slot < 0 || slot >= MAX_LAYOUT_PRESETS) return;
      const layoutPresets = [...current.layoutPresets];
      layoutPresets[slot] = null;
      commit({ ...current, layoutPresets });
    },

    replaceState: (next) => commit(next),

    undo: () => {
      // 保留中の編集バーストがあれば、まずそれを1ステップとして確定させてから戻す
      // （さもないと直近の未確定の編集がUndo対象に含まれず消えてしまう）。
      flushCoalesce();
      if (past.length === 0) return;
      const prev = past.pop()!;
      future.push(get().state);
      commit(prev, { history: false });
      set({ canUndo: past.length > 0, canRedo: future.length > 0 });
    },

    redo: () => {
      if (future.length === 0) return;
      const next = future.pop()!;
      past.push(get().state);
      commit(next, { history: false });
      set({ canUndo: past.length > 0, canRedo: future.length > 0 });
    },
  };
});
