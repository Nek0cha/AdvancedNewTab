import { createContext, useContext } from 'react';

/**
 * ウィンドウのリサイズ状況をGrid配下のウィジェットへ配るための軽量Context。
 *
 * 「サイズ変更時に自動で非表示にする」機能（WidgetFrame.tsx）が、ウィジェットごとに
 * 個別scriptを持たず一括で判定できるようにするための共有ステータス。ウィンドウ幅に
 * 依存する一時的なUI状態であり保存する意味が無いため、永続化されるZustandストアには
 * 入れず、Reduxのような使い捨てContextとして Grid.tsx がまとめて計算・供給する。
 */
export interface GridStatus {
  /** ウィンドウ幅をドラッグしている最中（Grid.tsx の useIsResizing 参照） */
  isResizing: boolean;
  /** 現在のブレークポイントが sm/xs（幅700px未満相当）で、常時「狭い」とみなす状態 */
  isNarrow: boolean;
}

const GridStatusContext = createContext<GridStatus>({ isResizing: false, isNarrow: false });

export const GridStatusProvider = GridStatusContext.Provider;

export function useGridStatus(): GridStatus {
  return useContext(GridStatusContext);
}
