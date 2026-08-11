/**
 * ウィジェット単位の「文字色・アクセントカラー・サブアクセントカラー・太さ」個別設定。
 *
 * lib/widget-background.ts（個別背景）と全く同じ構造。既定では見た目タブのテーマ設定
 * （文字色・アクセント色・サブアクセントカラー・文字の太さ）にそのまま従う。「個別に指定」を
 * 選んだ項目だけ、そのウィジェットの `.frame` 配下だけに効く CSS カスタムプロパティの
 * 上書きを注入する。
 *
 * widgets/registry.ts の register() が、このモジュールのフィールドを全ウィジェットの
 * defaultSettings / settingsSchema へ自動的に注入する（各ウィジェットファイル側で
 * 個別にスプレッドする必要はない）。
 */
import type { CSSProperties } from 'react';

import { applyMutedAlpha, computeAccentRing, computeMutedColor } from '@/lib/color';
import { WEIGHT_PRESET_DELTA, WIDGET_WEIGHT_PRESET_OPTIONS, type WeightPreset } from '@/lib/text-weight';
import type { ThemeConfig } from '@/lib/types';
import type { FieldSchema } from '@/widgets/types';

export interface WidgetTextSettings extends Record<string, unknown> {
  textMode: 'default' | 'custom';
  /** 文字色（個別モードのときだけ使う） */
  textColor: string;
  accentMode: 'default' | 'custom';
  /** アクセントカラー（個別モードのときだけ使う） */
  accentColor: string;
  subAccentMode: 'default' | 'custom';
  /** サブアクセントカラー（個別モードのときだけ使う） */
  subAccentColor: string;
  /** 'default' なら見た目タブの「文字の太さ」に委ねる */
  weightPreset: 'default' | WeightPreset;
}

export const WIDGET_TEXT_DEFAULTS: WidgetTextSettings = {
  textMode: 'default',
  textColor: '#f1ecec',
  accentMode: 'default',
  accentColor: '#ff8a4c',
  subAccentMode: 'default',
  subAccentColor: '#f1ecec',
  weightPreset: 'default',
};

const TEXT_CUSTOM_ONLY: FieldSchema['visibleWhen'] = { key: 'textMode', equals: 'custom' };
const ACCENT_CUSTOM_ONLY: FieldSchema['visibleWhen'] = { key: 'accentMode', equals: 'custom' };
const SUB_ACCENT_CUSTOM_ONLY: FieldSchema['visibleWhen'] = { key: 'subAccentMode', equals: 'custom' };

/** 文字色・アクセントカラー・サブアクセントカラー・太さの個別設定フィールド一覧。 */
export function widgetTextFields(): FieldSchema[] {
  return [
    {
      kind: 'select',
      key: 'textMode',
      label: '文字色',
      variant: 'tabs',
      options: [
        { value: 'default', label: '既定' },
        { value: 'custom', label: '個別に指定' },
      ],
      help: '「個別に指定」を選ぶと、このウィジェットだけ文字色が変わります。',
    },
    { kind: 'color', key: 'textColor', label: '文字色（個別）', visibleWhen: TEXT_CUSTOM_ONLY },
    {
      kind: 'select',
      key: 'accentMode',
      label: 'アクセントカラー',
      variant: 'tabs',
      options: [
        { value: 'default', label: '既定' },
        { value: 'custom', label: '個別に指定' },
      ],
      help: '「個別に指定」を選ぶと、このウィジェットだけアクセントカラーが変わります。',
    },
    { kind: 'color', key: 'accentColor', label: 'アクセントカラー（個別）', visibleWhen: ACCENT_CUSTOM_ONLY },
    {
      kind: 'select',
      key: 'subAccentMode',
      label: 'サブアクセントカラー',
      variant: 'tabs',
      options: [
        { value: 'default', label: '既定' },
        { value: 'custom', label: '個別に指定' },
      ],
      help: 'カレンダーの曜日・目盛り・プレースホルダーなど、カード内で控えめに表示する文字の色です。「個別に指定」を選ぶと、このウィジェットだけ変わります。',
    },
    { kind: 'color', key: 'subAccentColor', label: 'サブアクセントカラー（個別）', visibleWhen: SUB_ACCENT_CUSTOM_ONLY },
    {
      kind: 'select',
      key: 'weightPreset',
      label: '文字の太さ',
      variant: 'tabs',
      options: WIDGET_WEIGHT_PRESET_OPTIONS,
      help: '「既定」以外を選ぶと、このウィジェットだけ文字の太さが変わります。',
    },
  ];
}

/** getWidgetTextStyle が参照するテーマ側の実効値。 */
type EffectiveTheme = Pick<ThemeConfig, 'textColor' | 'accentColor' | 'subAccentMode' | 'subAccentBlend'>;

/**
 * 実際にウィジェットの外枠（`.frame`）へ適用する style オブジェクトを作る。
 * すべて既定なら undefined（＝呼び出し側は何も上書きしない）。
 *
 * `--ant-muted`（サブアクセントカラー） / `--ant-accent-ring` は `--ant-text` / `--ant-accent`
 * から導出される値のため、CSSの `var()` 連鎖に任せず（宣言された要素の時点でしか解決されない
 * ため、子孫での上書きに追従しない）、ここでJS側で明示的に再計算してセットし直す
 * （lib/theme.ts の applyTheme と同じ考え方）。
 *
 * サブアクセントカラーの優先順位: ウィジェット個別の `subAccentMode:'custom'` が最優先。
 * それ以外は、文字色かアクセントカラーのどちらかが個別指定されていて、かつテーマ側が
 * 'auto'（自動計算）のときだけ実効値から再計算する。テーマ側が 'custom'（色を直接指定）の
 * ときは、ウィジェット個別のサブアクセント指定が無ければ root の固定色をそのまま継承させる
 * （text/accentがいくら変わっても再計算の必要が無いため）。
 */
export function getWidgetTextStyle(
  settings: WidgetTextSettings,
  theme: EffectiveTheme,
): (CSSProperties & Record<string, string>) | undefined {
  if (
    settings.textMode === 'default' &&
    settings.accentMode === 'default' &&
    settings.subAccentMode === 'default' &&
    settings.weightPreset === 'default'
  ) {
    return undefined;
  }

  const effectiveText = settings.textMode === 'custom' ? settings.textColor : theme.textColor;
  const effectiveAccent = settings.accentMode === 'custom' ? settings.accentColor : theme.accentColor;

  const style: CSSProperties & Record<string, string> = {};

  if (settings.textMode === 'custom') {
    // これだけでは実は不十分（color は継承プロパティで、body の color: var(--ant-text) が
    // 先に具体値へ解決されて下流へ継承されるため、素の <div> の子孫は再解決されない）。
    // components/WidgetFrame/widget-frame.module.css の .body 側にも
    // color: var(--ant-text) を明示させ、そこで .frame のこのカスタムプロパティを
    // 使って改めて解決させることで初めて効く（詳細はそちらのコメント参照）。
    style['--ant-text'] = effectiveText;
  }
  if (settings.accentMode === 'custom') {
    style['--ant-accent'] = effectiveAccent;
    style['--ant-accent-ring'] = computeAccentRing(effectiveAccent);
  }

  if (settings.subAccentMode === 'custom') {
    style['--ant-muted'] = applyMutedAlpha(settings.subAccentColor);
  } else if ((settings.textMode === 'custom' || settings.accentMode === 'custom') && theme.subAccentMode !== 'custom') {
    style['--ant-muted'] = computeMutedColor(effectiveText, effectiveAccent, theme.subAccentBlend);
  }

  if (settings.weightPreset !== 'default') {
    style['--ant-weight-delta'] = String(WEIGHT_PRESET_DELTA[settings.weightPreset]);
  }

  return style;
}

/**
 * 「文字色」を既定→個別に指定へ切り替えた瞬間、色欄を既定値（白系）からではなく
 * 今のテーマの実効値から始めるためのパッチ。components/SettingsPanel/WidgetSettingsPanel.tsx
 * の onChange から使う。
 */
export function textModeSwitchPatch(theme: ThemeConfig): Partial<WidgetTextSettings> {
  return { textColor: theme.textColor };
}

/** 上と同じ理由で、アクセントカラーを個別に指定へ切り替えたときのパッチ。 */
export function accentModeSwitchPatch(theme: ThemeConfig): Partial<WidgetTextSettings> {
  return { accentColor: theme.accentColor };
}

/**
 * 上と同じ理由で、サブアクセントカラーを個別に指定へ切り替えたときのパッチ。
 * サブアクセントカラーの実効値そのもの（color-mix() の計算式）は `<input type="color">` に
 * 入れられる単純な16進色ではないため、テーマが 'custom'（色を直接指定）ならその色を、
 * 'auto'（自動計算）ならアクセント色を近似の初期値としてコピーする。
 */
export function subAccentModeSwitchPatch(theme: ThemeConfig): Partial<WidgetTextSettings> {
  return { subAccentColor: theme.subAccentMode === 'custom' ? theme.subAccentColor : theme.accentColor };
}
