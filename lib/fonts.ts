/**
 * ウィジェット面（新規タブのキャンバス）で選べるフォントの候補一覧。
 *
 * 「完全自由入力」ではなく「王道フォントから選ぶ」形にしている。フォント名の
 * 手打ちはタイプミスやインストール有無の差でフォールバック地獄になりやすいため。
 * 同梱フォント（lib/fonts.css）は Latin グリフのみで、日本語は OS 標準の
 * 日本語フォントへ委ねる方針のため、すべての候補が日本語フォールバックを持つ。
 */

const JP_FALLBACK =
  '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif';

export interface FontOption {
  id: string;
  label: string;
  /** font-family へそのまま渡す値（日本語フォールバック込み） */
  stack: string;
  /** 見た目パネルのプレビュー用の一言 */
  sample: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: 'system',
    label: 'システム標準',
    stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", ${JP_FALLBACK}`,
    sample: 'OSに合わせた標準フォント',
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk',
    stack: `"Space Grotesk", ${JP_FALLBACK}`,
    sample: '幾何学的でやや個性的なサンセリフ',
  },
  {
    id: 'ibm-plex-sans',
    label: 'IBM Plex Sans',
    stack: `"IBM Plex Sans", ${JP_FALLBACK}`,
    sample: '読みやすく実務的なサンセリフ',
  },
  {
    id: 'jetbrains-mono',
    label: 'JetBrains Mono',
    stack: `"JetBrains Mono", ${JP_FALLBACK}, monospace`,
    sample: '等幅・ターミナル風',
  },
  {
    id: 'yu-gothic',
    label: '游ゴシック',
    stack: '"Yu Gothic UI", "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif',
    sample: 'Windows/Macに標準の日本語ゴシック',
  },
  {
    id: 'georgia',
    label: 'Georgia（セリフ）',
    stack: `Georgia, "Hiragino Mincho ProN", serif`,
    sample: '欧文セリフ体',
  },
];

export const DEFAULT_FONT_ID = 'system';

export function getFontStack(id: string): string {
  return FONT_OPTIONS.find((f) => f.id === id)?.stack ?? FONT_OPTIONS[0]!.stack;
}
