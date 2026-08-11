/**
 * 「アイコン」フィールド（widgets/types.ts の FieldSchema kind:'icon'）が保持する値。
 * ウィジェット側の設定オブジェクトには、この形の JSON がそのまま入る。
 */
export type IconValue =
  | { source: 'default' }
  | { source: 'lucide'; id: string }
  | { source: 'image'; dataUrl: string }
  | { source: 'svg'; code: string }
  | { source: 'url'; url: string };

export const DEFAULT_ICON_VALUE: IconValue = { source: 'default' };

/**
 * `fill="currentColor"` 前提のSVGアイコン（プリセット等）を、常時ダークな編集UI
 * （SidePanelのメニュー・設定パネル。テーマ非依存で `--ant-menu-bg` 等の固定色を使う箇所）
 * の上で表示するときに使う、明るい色への固定tint。
 *
 * `<img src="data:image/svg+xml,...">` はページのCSS（currentColorを含む）を継承できない
 * 独立した描画コンテキストのため、放置すると既定の黒でレンダリングされ、暗い背景に
 * 埋もれて見えなくなる（tintSvgCode でSVG文字列自体を書き換えて色を焼き込むしかない）。
 * components/Field/AddWithPresets.tsx のプリセット一覧アイコンと同じ理由・同じ値。
 */
export const DARK_UI_ICON_TINT = '#f1ecec';

/** 保存されている値が壊れていても安全に既定値へフォールバックする。 */
export function normalizeIconValue(value: unknown): IconValue {
  if (!value || typeof value !== 'object' || !('source' in value)) return DEFAULT_ICON_VALUE;
  const v = value as { source: unknown };
  switch (v.source) {
    case 'lucide':
      return typeof (value as { id?: unknown }).id === 'string'
        ? (value as IconValue)
        : DEFAULT_ICON_VALUE;
    case 'image':
      return typeof (value as { dataUrl?: unknown }).dataUrl === 'string'
        ? (value as IconValue)
        : DEFAULT_ICON_VALUE;
    case 'svg':
      return typeof (value as { code?: unknown }).code === 'string'
        ? (value as IconValue)
        : DEFAULT_ICON_VALUE;
    case 'url':
      return typeof (value as { url?: unknown }).url === 'string'
        ? (value as IconValue)
        : DEFAULT_ICON_VALUE;
    default:
      return DEFAULT_ICON_VALUE;
  }
}

/** SVGコードをそのまま <img> の src にできる data URL へ変換する。 */
export function svgToDataUrl(code: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(code)}`;
}

/**
 * SVGコード内の `currentColor` をすべて指定色へ置き換える。
 *
 * <img src="data:..."> として描画したSVGは、ページ側のCSS（color / currentColor の
 * 継承）が一切効かない別ドキュメント扱いになる（<img> は不透明な置換要素のため）。
 * そのためCSSでの色変更ができず、色を変えたいならSVGの文字列そのものを
 * 書き換えるしかない。IconValueDisplay の svgTint 経由で使う。
 *
 * Iconify（Simple Icons等）系のアイコンは慣習として `fill="currentColor"` を使っており、
 * このプロジェクトで同梱しているプリセット（lib/link-presets.ts）もすべてこの形式のため、
 * 単純な文字列置換で対応できる。currentColor を使っていないSVGを貼り付けた場合は、
 * 元の配色のまま変わらない（安全側に倒れるだけで、壊れたり真っ黒になったりはしない）。
 */
export function tintSvgCode(code: string, color: string): string {
  return code.replace(/currentColor/gi, color);
}
