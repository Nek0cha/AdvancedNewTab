/**
 * 文字の太さ（プリセット）の共有定義。
 *
 * 「絶対値での太さ指定」ではなく「既存の太さへのオフセット（delta）」にしている。
 * ウィジェットごとに見出し・本文・数値表示など異なる font-weight を意図的に使い分けている
 * （widgets/clock の .time:300 と .meridiem:500 など）ため、1つの絶対値で全部を上書きすると
 * その意図した強弱関係が壊れる。各 .module.css 側の font-weight を
 * `calc(<元の値> + var(--ant-weight-delta, 0))` という相対指定に変換し、この delta 分だけ
 * 全体を細く/太くする。
 */

export const WEIGHT_PRESET_DELTA = {
  light: 0,
  normal: 100,
  bold: 200,
} as const;

export type WeightPreset = keyof typeof WEIGHT_PRESET_DELTA;

/** 見た目タブ（全体設定）用。全体には「既定」という概念がなく、常にいずれかの太さを持つ。 */
export const WEIGHT_PRESET_OPTIONS: ReadonlyArray<{ value: WeightPreset; label: string }> = [
  { value: 'light', label: '細め' },
  { value: 'normal', label: '標準' },
  { value: 'bold', label: '太め' },
];

/** ウィジェット個別設定用。「既定」＝全体設定のプリセットに委ねる、を選択肢に含める。 */
export const WIDGET_WEIGHT_PRESET_OPTIONS: ReadonlyArray<{ value: 'default' | WeightPreset; label: string }> = [
  { value: 'default', label: '既定' },
  ...WEIGHT_PRESET_OPTIONS,
];
