/**
 * 「ページの縦の長さを画面ちょうど1枚分に固定する」ための行数・行の高さの計算。
 *
 * components/Grid/Grid.tsx（実際の描画用）と lib/store.ts の addWidget/duplicateWidget
 * （新規ウィジェットを画面内に収まる位置へ置くための概算）の両方から使うため、
 * 計算式を1箇所にまとめている。ズレると「Grid側ではmaxRows=7なのに追加時は
 * maxRows=6で計算していた」のような食い違いが起きる。
 */

/** グリッドコンテナの上下パディング（Grid.tsx の CONTAINER_PADDING[1] と揃える）。 */
export const GRID_CONTAINER_PADDING_Y = 24;
/** 保険的な最小行数。極端に行の高さを大きくした場合でも操作不能にならないようにする。 */
export const GRID_MIN_ROWS = 4;

export interface GridMetrics {
  maxRows: number;
  /** 実際に描画に使う行の高さ（画面下端まで端数なく埋まるよう逆算した値）。 */
  resolvedRowHeight: number;
}

export function computeGridMetrics(viewportHeight: number, rowHeight: number, gridMargin: number): GridMetrics {
  const rowUnit = rowHeight + gridMargin;
  const usableHeight = viewportHeight - GRID_CONTAINER_PADDING_Y * 2;
  const rows = Math.max(GRID_MIN_ROWS, Math.round(usableHeight / rowUnit));
  const resolvedRowHeight = Math.max(20, (usableHeight - (rows - 1) * gridMargin) / rows);
  return { maxRows: rows, resolvedRowHeight };
}
