import { useCallback, useEffect, useMemo, useRef, useState, type Ref } from 'react';
import {
  ResponsiveGridLayout,
  getBreakpointFromWidth,
  noCompactor,
  useContainerWidth,
  type Layout,
  type LayoutItem,
  type ResizeHandleAxis,
} from 'react-grid-layout';

import { WidgetFrame } from '@/components/WidgetFrame/WidgetFrame';
import { cx } from '@/lib/cx';
import { findOverlappingIds, resolveOverlaps } from '@/lib/grid-collision';
import { computeGridMetrics, GRID_CONTAINER_PADDING_Y } from '@/lib/grid-metrics';
import { useAppStore } from '@/lib/store';
import { BREAKPOINTS, COLS, type BreakpointName } from '@/lib/types';

import { GridStatusProvider } from './GridStatusContext';
import { ResizeHandle } from './ResizeHandle';
import styles from './grid.module.css';

/**
 * ウィンドウ幅をドラッグしている最中かどうかを追跡する。
 *
 * 「サイズ変更時に自動で非表示にする」機能（GridStatusContext / WidgetFrame.tsx）が、
 * ドラッグの一瞬一瞬のブレークポイント切り替わりでウィジェットがガタつくのを隠すために使う。
 * `resize` イベントは連打されるため、350ms 無操作が続いたら「落ち着いた」とみなして false に戻す
 * （useViewportHeight と同じ resize リスナーの書き味）。
 */
const RESIZE_SETTLE_MS = 350;

function useIsResizing(): boolean {
  const [isResizing, setIsResizing] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = (): void => {
      setIsResizing(true);
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => setIsResizing(false), RESIZE_SETTLE_MS);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, []);
  return isResizing;
}

/** 参照の同一性を保つため、毎回の再生成を避けてモジュール定数にしている。 */
const CONTAINER_PADDING = [24, GRID_CONTAINER_PADDING_Y] as const;

/**
 * resizeConfig.handleComponent に渡す描画関数。コンポーネント内で毎回作り直すと
 * react-grid-layout 側の比較で無駄な再生成が起きるため、参照が安定するよう
 * モジュールスコープの定数にしている（依存する値が無いのでこれで十分）。
 */
function renderResizeHandle(axis: ResizeHandleAxis, ref: Ref<HTMLElement>) {
  return <ResizeHandle ref={ref as Ref<HTMLSpanElement>} axis={axis} />;
}

/** 画面の高さを追跡する。ウィンドウのリサイズに追従して maxRows を再計算するために使う。 */
function useViewportHeight(): number {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = (): void => setHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return height;
}

/**
 * react-grid-layout から受け取ったレイアウトを、保存用の素朴なオブジェクトに写し取る。
 *
 * 2つの目的がある。
 * 1. ライブラリは内部でレイアウト項目を破壊的に書き換えるため、参照を共有したまま
 *    保存すると、後のドラッグでストアの中身が知らないうちに変わってしまう。
 * 2. 内部フラグ（moved など）や false のままの static を落とし、保存されるJSONを安定させる。
 *    キーの並びを defaults.ts と揃えてあるので、変更がないときは文字列比較で同値になる。
 */
function sanitizeLayout(layout: Layout): LayoutItem[] {
  return layout.map((item) => {
    const next: LayoutItem = { i: item.i, x: item.x, y: item.y, w: item.w, h: item.h };
    if (item.minW !== undefined) next.minW = item.minW;
    if (item.minH !== undefined) next.minH = item.minH;
    if (item.maxW !== undefined) next.maxW = item.maxW;
    if (item.maxH !== undefined) next.maxH = item.maxH;
    if (item.static) next.static = true;
    return next;
  });
}

/**
 * `.i` の昇順に並べ替えて配列順を正規化する。
 *
 * react-grid-layout は内部処理の過程でレイアウト配列の並び順を変えることがある
 * （中身は同じでも順序が違う）。JSON.stringify による同値比較は配列順に敏感なため、
 * 正規化せずに比較すると「実質変化なし」なのに毎回「変化あり」と誤判定してしまう。
 * これが setLayouts → props更新 → ライブラリの再通知 → setLayouts → ... という
 * 無限ループ（React error #185）を引き起こしていた。保存前に必ずこれを通す。
 */
function canonicalOrder(layout: ReadonlyArray<LayoutItem>): LayoutItem[] {
  return [...layout].sort((a, b) => a.i.localeCompare(b.i));
}

export function Grid() {
  const editMode = useAppStore((s) => s.editMode);
  const theme = useAppStore((s) => s.state.theme);
  const layouts = useAppStore((s) => s.state.layouts);
  const widgets = useAppStore((s) => s.state.widgets);
  const setLayouts = useAppStore((s) => s.setLayouts);

  // WidthProvider(HOC) の後継。ResizeObserver でコンテナ幅を追う。
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const viewportHeight = useViewportHeight();
  const isResizing = useIsResizing();

  /**
   * ページの縦の長さを画面ちょうど1枚分に固定する。
   *
   * react-grid-layout はドラッグ・リサイズ中、座標を `maxRows` の範囲内へ自動的に
   * クランプする（node_modules/react-grid-layout の calcGridItemPosition 参照）ため、
   * ここを画面の高さちょうどに合わせておくだけで「それより下へは動かせない・
   * 広げられない」が実現できる。個別に禁止処理を書く必要はない。
   *
   * 行数を `theme.rowHeight` から素朴に floor すると、割り切れない端数分（最大で
   * 1行弱）が画面下部に「置けない余白」として残ってしまう。そこで行数はユーザー設定の
   * rowHeight に最も近くなる本数（round）を選び、実際に描画に使う行の高さ
   * （`resolvedRowHeight`）の方を「その本数でちょうど画面下端まで埋まる値」に
   * 逆算する。ユーザーが設定した rowHeight は行数を選ぶ基準として使われるだけで、
   * 実際のピクセル値は画面サイズに応じて数px単位で微調整される（テーマ設定の
   * 見た目を大きく変えない範囲に収まる）。
   */
  const { maxRows, resolvedRowHeight } = useMemo(
    () => computeGridMetrics(viewportHeight, theme.rowHeight, theme.gridMargin),
    [viewportHeight, theme.rowHeight, theme.gridMargin],
  );

  const breakpoint = useMemo(
    () => getBreakpointFromWidth(BREAKPOINTS, width) as BreakpointName,
    [width],
  );

  // lg（1400px以上）以外はすべて「狭い」とみなし、GridStatusContext 経由で
  // WidgetFrame の自動非表示判定に使う。
  //
  // 当初は sm/xs（700px未満）だけを対象にしていたが、実際に使ってみると
  // lg⇔md の境界（1400px付近）でもブレークポイントが切り替わった瞬間に
  // 配置が一時的に崩れて見える不具合が出ていた。md幅にはmd用に保存された
  // レイアウトがあるので必ずしも壊れているわけではないが、境界を跨ぐ操作
  // （ウィンドウの手動リサイズ等）の最中は見た目のガタつきの方が気になるため、
  // lg未満はまとめて「狭い」扱いにして早めに隠すようにした。
  const isNarrow = breakpoint !== 'lg';
  const gridStatus = useMemo(() => ({ isResizing, isNarrow }), [isResizing, isNarrow]);

  /**
   * ドラッグ／リサイズを開始した瞬間の状態を覚えておく。
   * resolveOverlaps が「操作前の位置」へ他のウィジェットを戻すための基準になる
   * （lib/grid-collision.ts 参照）。
   */
  const beforeLayoutRef = useRef<LayoutItem[]>([]);
  const movingIdRef = useRef<string | null>(null);

  const handleOperationStart = useCallback(
    (startLayout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null) => {
      beforeLayoutRef.current = sanitizeLayout(startLayout);
      movingIdRef.current = newItem?.i ?? oldItem?.i ?? null;
    },
    [],
  );

  /**
   * 現在のブレークポイントの配置を保存する。
   * 変化がなければ書き込まないので、新規タブを開いただけでは storage に触れない。
   *
   * `compactor` prop はライブラリの実行中ずっと type: null（下の dragCompactor、
   * noCompactor 系統）で固定している。react-grid-layout 2.2.4 は compactor に
   * verticalCompactor を渡した状態でコンポーネントがマウントされるとドラッグ自体が
   * 反応しなくなる不具合があるため。重なりの解消・詰めは、確定後のレイアウトに対して
   * ここで自前ロジック（lib/grid-collision.ts）を適用することで安全に実現している。
   */
  const commitLayout = useCallback(
    (next: Layout, options?: { resolve?: boolean }) => {
      const current = useAppStore.getState().state.layouts;
      let settled = sanitizeLayout(next);

      if (options?.resolve && movingIdRef.current) {
        // 注意: ここで floatUp（上に詰める）を続けて適用してはいけない。
        //
        // floatUp は「y の小さい順に、既に確定した項目とぶつからない範囲で
        // 可能な限り上へ詰める」処理のため、resolveOverlaps が意図的に
        // 「重ねた相手のすぐ下」へ押し出した項目まで、隙間があれば問答無用で
        // 上へ引き戻してしまう。これにより「重ねたら直下へ移動・離したら
        // 元位置へ復帰」という意図した挙動が、floatUp によって毎回
        // 打ち消されて別の配置になり、「押し出しも復帰も効いていないように見える」
        // 不具合になっていた。resolveOverlaps の結果を最終形として扱う。
        settled = resolveOverlaps(settled, movingIdRef.current, beforeLayoutRef.current, maxRows);
      }

      // 比較・保存の直前に必ず正規化する（canonicalOrder のコメント参照）。
      settled = canonicalOrder(settled);
      const merged = { ...current, [breakpoint]: settled };

      /*
       * resolve 時（ドラッグ／リサイズ確定後）は、内容が保存済みの値と一致していても
       * 必ず setLayouts を呼ぶ。
       *
       * react-grid-layout はドラッグ中、他のウィジェットを自前で押し出した見た目を
       * 内部状態として保持しており、それは resolveOverlaps を経た「正しい」結果とは
       * 別物になっていることがある（例: ドラッグ→重ねる→そのまま元の位置へ戻す、という
       * 一連の操作の結果が保存済みの値とたまたま一致するケース）。ここで setLayouts を
       * 呼ばずに早期リターンすると、ストアの中身は正しいのに、ライブラリ側の画面表示
       * だけがドラッグ中の押し出された見た目のまま取り残されてしまう
       * （データは合っているのに画面だけ元に戻っていないように見える不具合）。
       * setLayouts を呼んで layouts プロップの参照を必ず更新することで、
       * ライブラリに正しい配置への再同期を強制する。
       *
       * resolve を伴わない呼び出し（現状は使っていないが将来のために残す）は、
       * 従来どおり無駄な書き込みを避けるため内容が同じなら何もしない。
       */
      if (!options?.resolve) {
        const currentBreakpointLayout = current[breakpoint];
        const comparableCurrent = currentBreakpointLayout
          ? { ...current, [breakpoint]: canonicalOrder(currentBreakpointLayout) }
          : current;
        if (JSON.stringify(merged) === JSON.stringify(comparableCurrent)) return;
      }

      setLayouts(merged);
    },
    [breakpoint, setLayouts, maxRows],
  );

  const margin = useMemo(
    () => [theme.gridMargin, theme.gridMargin] as readonly [number, number],
    [theme.gridMargin],
  );

  /**
   * ドラッグ中の「重ねたら直下へ移動・離したら元位置へ戻る」が不安定に見えていた
   * 根本原因はここだった。noCompactor（allowOverlap: false）のままだと、react-grid-layout
   * は compactor の type が null であっても、ドラッグ中の毎フレーム（onDrag）ごとに
   * 内部の moveElement() で「北側の衝突相手と位置を入れ替える」処理を勝手に実行し、
   * ドラッグしている本人以外のウィジェットまでライブラリ自身の判断でリアルタイムに
   * 動かしてしまう（node_modules/react-grid-layout の moveElementAwayFromCollision、
   * compactType === null の分岐を参照）。この「入れ替え」はドラッグの経路に依存する
   * 場当たり的なもので、こちらが onDragStop で計算する resolveOverlaps の結果とは
   * 別物になりやすく、指を離した瞬間に見た目が別の配置へガクッと飛ぶ＝「不安定」の
   * 正体になっていた。
   *
   * allowOverlap: true にすると、moveElement は衝突を検知しても他のウィジェットに
   * 一切触れず（自分自身の座標だけを更新して終わる）、ドラッグ中は常に「掴んでいる
   * ウィジェットだけが動き、他は微動だにしない」見た目になる。押し出し・復帰は
   * onDragStop/onResizeStop 後に resolveOverlaps だけが1回で決定するため、
   * ドラッグ中の見た目と結果が食い違ってガクつくことがなくなる。
   */
  const dragCompactor = useMemo(() => ({ ...noCompactor, allowOverlap: true }), []);

  const dragConfig = useMemo(
    () => ({
      enabled: editMode,
      // ヘッダの設定・削除ボタンはクリックとして扱いたいのでドラッグ対象から外す
      cancel: '.ant-no-drag',
      threshold: 3,
      // 注意: dragConfig.bounded: true は react-grid-layout 2.2.4 では
      // ドラッグそのものが一切動かなくなる不具合があるため使わない
      // （isBounded の内部計算がおかしく、開始直後に「境界外」と誤判定される）。
      // 水平方向のはみ出し防止は Grid.module.css の overflow-x: clip 側で処理する。
    }),
    [editMode],
  );

  // 右下に加えて左下からもリサイズできるようにする。'sw' は x が変わる方向の
  // リサイズなので、react-grid-layout 側が x も追従して計算してくれる
  // （widgets/types.ts の座標系はそのまま、特別な対応は不要）。
  //
  // handleComponent は自前描画（components/Grid/ResizeHandle.tsx）に差し替えている。
  // react-resizable の既定ハンドルをCSSで上書きする方式だと、左下側だけ既定の
  // 背景画像や位置指定が完全には打ち消せず、白い残留物や右下との縦位置ズレが
  // 実機で解消しなかったため（!important を足しても直らなかった）、
  // 既定の描画を経由しない方式に切り替えている。
  const resizeConfig = useMemo(
    () => ({ enabled: editMode, handles: ['se', 'sw'] as const, handleComponent: renderResizeHandle }),
    [editMode],
  );

  // resolveOverlaps の maxRows クランプは、置き場所が本当に無いケースでは重なりを
  // 完全に解消しない（コメント参照）。その残った重なりを WidgetFrame 側で警告表示するため、
  // 現在のブレークポイントのレイアウトから毎回検出しておく。
  const overlappingIds = useMemo(
    () => findOverlappingIds(layouts[breakpoint] ?? []),
    [layouts, breakpoint],
  );

  const children = useMemo(
    () =>
      Object.keys(widgets).map((instanceId) => (
        <WidgetFrame key={instanceId} instanceId={instanceId} overlapping={overlappingIds.has(instanceId)} />
      )),
    [widgets, overlappingIds],
  );

  return (
    <GridStatusProvider value={gridStatus}>
    <div ref={containerRef} className={cx(styles.container, editMode && 'ant-edit-mode')}>
      {/*
        幅が確定する前に描くと、いったん最小ブレークポイント（xs）で組まれてしまう。
        見た目が一瞬崩れるだけでなく、その崩れた配置が保存されてしまうため、
        width > 0 になるまで描画を待つ。
      */}
      {mounted && width > 0 && (
        <ResponsiveGridLayout<BreakpointName>
          width={width}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          layouts={layouts}
          rowHeight={resolvedRowHeight}
          maxRows={maxRows}
          margin={margin}
          containerPadding={CONTAINER_PADDING}
          // 常に dragCompactor（type: null かつ allowOverlap: true）を渡す。
          // 理由は commitLayout 直前の dragCompactor 定義コメントを参照。
          compactor={dragCompactor}
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          onDragStart={handleOperationStart}
          onResizeStart={handleOperationStart}
          /*
           * 保存の起点は onDragStop / onResizeStop のみにしている。onLayoutChange は
           * 意図的に何もしない。
           *
           * 理由: onDragStop で resolveOverlaps により重なりを解消して保存した直後にも、
           * react-grid-layout はライブラリ内部の（resolveOverlaps を経ていない、
           * ドラッグ中に自前で押し出しただけの生の）レイアウトを持ったまま
           * onLayoutChange を複数回発火し続ける。これを保存経路に繋いでいたせいで、
           * 直後にこちらが正しく解決した結果を、ライブラリ側の未解決の生データで
           * 上書きしてしまい、「重ねたら直下へ移動・離したら元位置へ戻る」がまったく
           * 効いていないように見える不具合になっていた（layouts prop 経由で正しい値を
           * 渡し直しても、ライブラリ側は自分の内部状態を優先して通知してくる）。
           *
           * ブレークポイントをまたいだ際に生成される新しいレイアウトを保存できなくなる
           * トレードオフはあるが、その場合でも既存レイアウトから自動生成される
           * レイアウトが毎回使われるだけで、操作不能にはならない。
           */
          onDragStop={(next) => commitLayout(next, { resolve: true })}
          onResizeStop={(next) => commitLayout(next, { resolve: true })}
        >
          {children}
        </ResponsiveGridLayout>
      )}
    </div>
    </GridStatusProvider>
  );
}
