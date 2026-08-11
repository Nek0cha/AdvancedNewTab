/**
 * ウィジェット単位の「個別スタイル」設定。
 *
 * 既定では、frame:'card' のウィジェットは見た目タブの「ウィジェットカードの背景色」に、
 * frame:'bare'（時計・検索）は何も敷かない透明のままに委ねる。「個別に指定」を選んだ
 * ときだけ、ここの色・ぼかし・暗さ・角丸・枠線がそのウィジェットだけに効く。2つのモードは
 * 排他的（backgroundMode の select を参照）なので、既定の見た目と個別設定が二重に
 * 効くことはない。
 *
 * widgets/registry.ts の register() が、このモジュールのフィールドを全ウィジェットの
 * defaultSettings / settingsSchema へ自動的に注入する（各ウィジェットファイル側で
 * 個別にスプレッドする必要はない）。
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
  /** 枠線の太さ（px）。0で枠線なし */
  bgBorderWidth: number;
}

export const WIDGET_BACKGROUND_DEFAULTS: WidgetBackgroundSettings = {
  backgroundMode: 'default',
  bgColor: '#ffffff',
  bgOpacity: 0.4,
  bgBlur: 16,
  bgDim: 0,
  bgRadius: 18,
  bgBorderWidth: 0,
};

const CUSTOM_ONLY: FieldSchema['visibleWhen'] = { key: 'backgroundMode', equals: 'custom' };

/**
 * 個別スタイルのフィールド一覧。
 * @param opts.border 枠線の太さフィールドを含めるか（既定 true）。検索ウィジェットは
 *   個別背景を検索バーだけに適用する都合上、枠線は他の要素と馴染みが悪いため除外する。
 */
export function widgetBackgroundFields(opts?: { border?: boolean }): FieldSchema[] {
  const includeBorder = opts?.border ?? true;
  const fields: FieldSchema[] = [
    {
      kind: 'select',
      key: 'backgroundMode',
      label: '背景',
      variant: 'tabs',
      options: [
        { value: 'default', label: '既定' },
        { value: 'custom', label: '個別に指定' },
      ],
      help: '「個別に指定」を選ぶと、下の色・ぼかし・暗さ等がこのウィジェットだけに適用されます。',
    },
    { kind: 'color', key: 'bgColor', label: '背景色', visibleWhen: CUSTOM_ONLY },
    {
      kind: 'number',
      key: 'bgOpacity',
      label: '背景の不透明度',
      min: 0,
      max: 1,
      step: 0.05,
      visibleWhen: CUSTOM_ONLY,
    },
    { kind: 'number', key: 'bgBlur', label: '背景のぼかし（px）', min: 0, max: 40, step: 1, visibleWhen: CUSTOM_ONLY },
    {
      kind: 'number',
      key: 'bgDim',
      label: '背景の暗さ',
      min: 0,
      max: 1,
      step: 0.05,
      help: '背後を黒く沈める度合いです。背景色・不透明度とは独立して効きます。',
      visibleWhen: CUSTOM_ONLY,
    },
    { kind: 'number', key: 'bgRadius', label: '角の丸み（px）', min: 0, max: 60, step: 1, visibleWhen: CUSTOM_ONLY },
  ];
  if (includeBorder) {
    fields.push({
      kind: 'number',
      key: 'bgBorderWidth',
      label: '枠線の太さ（px）',
      min: 0,
      max: 8,
      step: 1,
      help: '0で枠線なしになります。',
      visibleWhen: CUSTOM_ONLY,
    });
  }
  return fields;
}

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
 *
 * 枠線の色はグローバルテーマの枠線色ではなく、個別の bgColor から導出する
 * （個別に指定した背景色と無関係な枠線色になると馴染まないため）。
 */
export function getWidgetBackgroundStyle(settings: WidgetBackgroundSettings): CSSProperties | undefined {
  if (settings.backgroundMode !== 'custom') return undefined;

  const layers: string[] = [];
  if (settings.bgDim > 0) {
    layers.push(`linear-gradient(rgba(0, 0, 0, ${settings.bgDim}), rgba(0, 0, 0, ${settings.bgDim}))`);
  }
  const baseColor = settings.bgOpacity > 0 ? `rgba(${hexToRgbString(settings.bgColor)}, ${settings.bgOpacity})` : 'transparent';
  layers.push(baseColor);

  const borderWidth = settings.bgBorderWidth ?? 0;

  return {
    background: layers.join(', '),
    borderRadius: `${settings.bgRadius}px`,
    border: borderWidth > 0 ? `${borderWidth}px solid rgba(${hexToRgbString(settings.bgColor)}, 0.4)` : undefined,
    // -webkit- を先に書く理由は widget-frame.module.css の .card と同じ
    // （entrypoints/newtab/style.css の注記参照）。
    WebkitBackdropFilter: settings.bgBlur > 0 ? `blur(${settings.bgBlur}px)` : undefined,
    backdropFilter: settings.bgBlur > 0 ? `blur(${settings.bgBlur}px)` : undefined,
    overflow: 'hidden',
  };
}
