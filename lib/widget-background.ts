/**
 * ウィジェット単位の「個別スタイル」設定。
 *
 * 既定では、frame:'card' のウィジェットは見た目タブの「ウィジェットカードの背景色」に、
 * frame:'bare'（時計・検索）は何も敷かない透明のままに委ねる。「個別に指定」を選んだ
 * ときだけ、ここの色・濃さ・ぼかし・角丸・枠線がそのウィジェットだけに効く。2つのモードは
 * 排他的（backgroundMode の select を参照）なので、既定の見た目と個別設定が二重に
 * 効くことはない。項目は見た目タブの「ウィジェットカードの背景色」「カードの濃さ」等と
 * 呼び方を揃えている（以前は「不透明度」「暗さ」という独自の呼び方の項目があり、
 * 見た目タブと語彙が違ってわかりにくいというフィードバックがあった）。
 *
 * widgets/registry.ts の register() が、このモジュールのフィールドを全ウィジェットの
 * defaultSettings / settingsSchema へ自動的に注入する（各ウィジェットファイル側で
 * 個別にスプレッドする必要はない）。
 */
import type { CSSProperties } from 'react';

import { CARD_OPACITY_SCALE, hexToRgbString } from '@/lib/color';
import type { ThemeConfig } from '@/lib/types';
import type { FieldSchema } from '@/widgets/types';

export interface WidgetBackgroundSettings extends Record<string, unknown> {
  backgroundMode: 'default' | 'custom';
  /** 背景色（個別モードのときだけ使う） */
  bgColor: string;
  /** 背景の濃さ（0で完全に透明、1で最も濃い）。見た目タブの「カードの濃さ」と同じ呼び方。 */
  bgOpacity: number;
  /** 背景のぼかし（px） */
  bgBlur: number;
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
      help: '「個別に指定」を選ぶと、下の色・濃さ・ぼかし等がこのウィジェットだけに適用されます。',
    },
    { kind: 'color', key: 'bgColor', label: '背景色', visibleWhen: CUSTOM_ONLY },
    {
      kind: 'number',
      key: 'bgOpacity',
      label: '濃さ',
      min: 0,
      max: 1,
      step: 0.05,
      help: '0 で完全に透明、1 で最も濃くなります。',
      visibleWhen: CUSTOM_ONLY,
    },
    { kind: 'number', key: 'bgBlur', label: '背景のぼかし（px）', min: 0, max: 40, step: 1, visibleWhen: CUSTOM_ONLY },
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
 * 濃さ（bgOpacity）は lib/theme.ts の見た目タブ側と同じ CARD_OPACITY_SCALE を掛けて
 * アルファ値に変換する。この換算を揃えないと、同じ「濃さ」の数値でも既定と個別指定とで
 * 見た目の不透明度が大きく食い違ってしまう（実際に起きていた不具合）。
 *
 * 枠線の色はグローバルテーマの枠線色ではなく、個別の bgColor から導出する
 * （個別に指定した背景色と無関係な枠線色になると馴染まないため）。
 */
export function getWidgetBackgroundStyle(settings: WidgetBackgroundSettings): CSSProperties | undefined {
  if (settings.backgroundMode !== 'custom') return undefined;

  const baseColor =
    settings.bgOpacity > 0
      ? `rgba(${hexToRgbString(settings.bgColor)}, ${settings.bgOpacity * CARD_OPACITY_SCALE})`
      : 'transparent';
  const borderWidth = settings.bgBorderWidth ?? 0;

  return {
    background: baseColor,
    borderRadius: `${settings.bgRadius}px`,
    border: borderWidth > 0 ? `${borderWidth}px solid rgba(${hexToRgbString(settings.bgColor)}, 0.4)` : undefined,
    // -webkit- を先に書く理由は widget-frame.module.css の .card と同じ
    // （entrypoints/newtab/style.css の注記参照）。
    WebkitBackdropFilter: settings.bgBlur > 0 ? `blur(${settings.bgBlur}px)` : undefined,
    backdropFilter: settings.bgBlur > 0 ? `blur(${settings.bgBlur}px)` : undefined,
    overflow: 'hidden',
  };
}

/**
 * 「背景」を既定→個別に指定へ切り替えた瞬間、色欄を既定値（白）からではなく、
 * 今実際に表示されているカードの見た目（見た目タブのカード設定）から始めるためのパッチ。
 * components/SettingsPanel/WidgetSettingsPanel.tsx の onChange から使う。
 */
export function backgroundModeSwitchPatch(theme: ThemeConfig): Partial<WidgetBackgroundSettings> {
  return {
    bgColor: theme.cardColor,
    bgOpacity: theme.cardOpacity,
    bgBlur: theme.cardBlur,
    bgRadius: theme.cardRadius,
    bgBorderWidth: theme.cardBorderWidth,
  };
}
