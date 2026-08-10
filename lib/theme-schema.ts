import type { FieldSchema } from '@/widgets/types';

/**
 * テーマ設定のフォーム宣言。
 * ウィジェットと同じ FieldSchema を使い、components/Field で描画する。
 * 背景とフォントだけは型がユニオン/アップロードを含み単純なキー・値に落ちないため、
 * 専用のエディタ（BackgroundEditor / FontEditor）を別に用意している。
 */
export const THEME_SCHEMA: ReadonlyArray<FieldSchema> = [
  {
    kind: 'select',
    key: 'mode',
    label: 'モード',
    options: [
      { value: 'dark', label: 'ダーク' },
      { value: 'light', label: 'ライト' },
    ],
    help: 'カード面や文字の既定色を切り替えます。',
  },
  {
    kind: 'text',
    key: 'tabTitle',
    label: '新しいタブページの名前',
    placeholder: '新しいタブ',
    help: 'ブラウザのタブに表示される名前です。',
  },
  { kind: 'color', key: 'textColor', label: '文字色' },
  { kind: 'color', key: 'accentColor', label: 'アクセント色' },
  {
    kind: 'color',
    key: 'cardColor',
    label: 'ウィジェットカードの背景色',
    help: 'カード表示のウィジェット全般の背景色です（濃さは下の「カードの濃さ」で別途調整）。',
  },
  {
    kind: 'number',
    key: 'cardOpacity',
    label: 'カードの濃さ',
    min: 0,
    max: 1,
    step: 0.02,
    help: '0 で完全に透明、1 で最も濃くなります。',
  },
  { kind: 'number', key: 'cardBlur', label: 'カードの背面ぼかし（px）', min: 0, max: 40, step: 1 },
  { kind: 'number', key: 'cardRadius', label: 'カードの角丸（px）', min: 0, max: 40, step: 1 },
  {
    kind: 'number',
    key: 'cardBorderWidth',
    label: 'カードの枠線の太さ（px）',
    min: 0,
    max: 6,
    step: 1,
    help: '0 で枠線なしになります。',
  },
  {
    kind: 'number',
    key: 'rowHeight',
    label: 'グリッド1行の高さ（px）',
    min: 30,
    max: 240,
    step: 5,
  },
  { kind: 'number', key: 'gridMargin', label: 'ウィジェット間の余白（px）', min: 0, max: 40, step: 1 },
];
