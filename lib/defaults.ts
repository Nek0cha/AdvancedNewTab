import { DEFAULT_FONT_ID } from '@/lib/fonts';
import type { PersistedState, ThemeConfig } from '@/lib/types';

/**
 * 現在のスキーマバージョン。
 * PersistedState の構造を後方互換なく変更したら +1 し、lib/storage.ts の migrate に処理を足す。
 */
export const SCHEMA_VERSION = 3;

export const DEFAULT_THEME: ThemeConfig = {
  background: {
    active: 'gradient',
    solid: { color: '#11141b' },
    gradient: { from: '#241a2e', to: '#0c0d14', angle: 155 },
    image: { src: '', fallbackColor: '#11141b', blur: 0, dim: 0.15 },
  },
  textColor: '#f1ecec',
  accentColor: '#ff8a4c',
  textWeightPreset: 'normal',
  subAccentMode: 'auto',
  subAccentBlend: 35,
  subAccentColor: '#f1ecec',
  canvasFontId: DEFAULT_FONT_ID,
  customFont: null,
  cardColor: '#ffffff',
  cardOpacity: 0.4,
  cardBlur: 16,
  cardRadius: 18,
  cardBorderWidth: 1,
  rowHeight: 80,
  gridMargin: 14,
  // 'vertical' を既定にしている。ウィジェットを重ねて押し出したとき、押し出された側が
  // 元の位置付近へ自動的に戻ってくる（Grid.tsx のドロップ後圧縮を参照）。
  gridCompact: 'vertical',
  tabTitle: '新しいタブ',
};

/**
 * 初回起動時の構成。
 *
 * 「完全にカスタマイズ可能」であることと、初回に真っ白なキャンバスを見せることは別問題である。
 * 何を置けばよいか分からない状態を避けるため、権限を必要としないウィジェットだけで
 * 成立する既定レイアウトをあらかじめ用意している。
 *
 * 注意: ここの各レイアウト項目の w/h/minW/minH は、対応する widgets/<type>/index.tsx の
 * defaultLayout とは別データとして持っている（widget追加ダイアログから足した場合は
 * defaultLayout が使われるが、ここは初回起動専用の固定値）。widget側の defaultLayout を
 * 変えたときはここも揃えて直すこと（揃え忘れると「新規追加したウィジェットとインストール
 * 直後からある既定ウィジェットとで最小/初期サイズが違う」というズレが起きる）。
 */
export function createDefaultState(): PersistedState {
  return {
    version: SCHEMA_VERSION,
    rev: 0,
    theme: DEFAULT_THEME,
    layouts: {
      lg: [
        { i: 'clock-1', x: 4, y: 0, w: 4, h: 2, minW: 2, minH: 1 },
        { i: 'search-1', x: 3, y: 2, w: 6, h: 1, minW: 3, minH: 1 },
        { i: 'links-1', x: 3, y: 3, w: 6, h: 3, minW: 2, minH: 1 },
      ],
      md: [
        { i: 'clock-1', x: 3, y: 0, w: 4, h: 2, minW: 2, minH: 1 },
        { i: 'search-1', x: 2, y: 2, w: 6, h: 1, minW: 3, minH: 1 },
        { i: 'links-1', x: 2, y: 3, w: 6, h: 3, minW: 2, minH: 1 },
      ],
      sm: [
        { i: 'clock-1', x: 1, y: 0, w: 4, h: 2, minW: 2, minH: 1 },
        { i: 'search-1', x: 0, y: 2, w: 6, h: 1, minW: 3, minH: 1 },
        { i: 'links-1', x: 0, y: 3, w: 6, h: 3, minW: 2, minH: 1 },
      ],
      xs: [
        { i: 'clock-1', x: 0, y: 0, w: 4, h: 2, minW: 2, minH: 1 },
        { i: 'search-1', x: 0, y: 2, w: 4, h: 1, minW: 3, minH: 1 },
        { i: 'links-1', x: 0, y: 3, w: 4, h: 3, minW: 2, minH: 1 },
      ],
    },
    widgets: {
      'clock-1': { type: 'clock', settings: {} },
      'search-1': { type: 'search', settings: {} },
      'links-1': { type: 'links', settings: {} },
    },
    toolbarPosition: null,
    layoutPresets: [null, null, null],
  };
}
