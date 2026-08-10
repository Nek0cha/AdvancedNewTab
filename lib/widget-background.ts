/**
 * frame:'bare' なウィジェット（時計・検索）向けの「個別背景」設定。
 *
 * これらのウィジェットは既定では背景を持たない（時計は文字だけ、検索は検索バー自体の
 * 見た目のみ）。「既定（backgroundMode:'default'）」を選んでいる間は一切スタイルを
 * 上書きせず、ウィジェット本来の見た目（bare の透明、または検索バー自前のCSS）に
 * 完全に委ねる。「個別（'custom'）」を選んだときだけ、ここの色・ぼかし・暗さ・角丸が
 * 有効になる。2つのモードは排他的なので、既定の見た目と個別設定のぼかし等が
 * 二重に効くことはない。
 */
import type { CSSProperties } from 'react';

import { hexToRgbString } from '@/lib/color';
import type { FieldSchema } from '@/widgets/types';

export interface WidgetBackgroundSettings extends Record<string, unknown> {
  backgroundMode: 'default' | 'custom';
  /** 背景色（個別モードのときだけ使う） */
  bgColor: string;
  /** 背景パネルの不透明度（0で非表示） */
  bgOpacity: number;
  /** 背景のぼかし（px） */
  bgBlur: number;
  /** 背景を黒く沈める度合い（0〜1、0で暗くしない） */
  bgDim: number;
  /** 角の丸み（px） */
  bgRadius: number;
}

export const WIDGET_BACKGROUND_DEFAULTS: WidgetBackgroundSettings = {
  backgroundMode: 'default',
  bgColor: '#ffffff',
  bgOpacity: 0.4,
  bgBlur: 16,
  bgDim: 0,
  bgRadius: 18,
};

export const WIDGET_BACKGROUND_FIELDS: ReadonlyArray<FieldSchema> = [
  {
    kind: 'select',
    key: 'backgroundMode',
    label: '背景',
    options: [
      { value: 'default', label: '既定（このウィジェット本来の見た目）' },
      { value: 'custom', label: '個別に指定する' },
    ],
    help: '「個別に指定する」を選んだときだけ、下の背景色・ぼかし・暗さ・角の丸みが使われます。',
  },
  { kind: 'color', key: 'bgColor', label: '背景色（個別選択時のみ）' },
  {
    kind: 'number',
    key: 'bgOpacity',
    label: '背景の不透明度（個別選択時のみ）',
    min: 0,
    max: 1,
    step: 0.05,
  },
  { kind: 'number', key: 'bgBlur', label: '背景のぼかし px（個別選択時のみ）', min: 0, max: 40, step: 1 },
  {
    kind: 'number',
    key: 'bgDim',
    label: '背景の暗さ（個別選択時のみ）',
    min: 0,
    max: 1,
    step: 0.05,
    help: '背後を黒く沈める度合いです。背景色・不透明度とは独立して効きます。',
  },
  { kind: 'number', key: 'bgRadius', label: '角の丸み px（個別選択時のみ）', min: 0, max: 60, step: 1 },
];

/**
 * 実際に要素へ適用する style オブジェクトを作る。既定モードなら undefined
 * （＝呼び出し側は何も上書きせず、ウィジェット本来の見た目のまま）。
 *
 * 暗さ（bgDim）と背景色は、別要素を重ねるのではなく `background` に
 * グラデーション層＋色をカンマ区切りで並べる1プロパティで表現している
 * （`background: linear-gradient(...), <color>;` は最後の色だけが背景色として
 * 解釈される正当なCSS）。これにより、時計のように全体を包む場合だけでなく、
 * 検索バーの `<form>` のような「既に別のレイアウト用スタイルを持つ要素」にも
 * 追加のラッパー要素なしでそのまま style として渡せる。
 */
export function getWidgetBackgroundStyle(settings: WidgetBackgroundSettings): CSSProperties | undefined {
  if (settings.backgroundMode !== 'custom') return undefined;

  const layers: string[] = [];
  if (settings.bgDim > 0) {
    layers.push(`linear-gradient(rgba(0, 0, 0, ${settings.bgDim}), rgba(0, 0, 0, ${settings.bgDim}))`);
  }
  const baseColor = settings.bgOpacity > 0 ? `rgba(${hexToRgbString(settings.bgColor)}, ${settings.bgOpacity})` : 'transparent';
  layers.push(baseColor);

  return {
    background: layers.join(', '),
    borderRadius: `${settings.bgRadius}px`,
    // -webkit- を先に書く理由は widget-frame.module.css の .card と同じ
    // （entrypoints/newtab/style.css の注記参照）。
    WebkitBackdropFilter: settings.bgBlur > 0 ? `blur(${settings.bgBlur}px)` : undefined,
    backdropFilter: settings.bgBlur > 0 ? `blur(${settings.bgBlur}px)` : undefined,
    overflow: 'hidden',
  };
}
