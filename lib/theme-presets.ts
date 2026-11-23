import { DEFAULT_THEME } from '@/lib/defaults';
import type { BackgroundConfig, ThemeConfig } from '@/lib/types';

/** プリセットが上書きする項目。フォント・グリッド寸法・言語・タブ名は利用者の好みなので触らない */
type PresetTheme = Pick<
  ThemeConfig,
  'textColor' | 'accentColor' | 'cardColor' | 'cardOpacity' | 'cardBlur' | 'cardRadius' | 'cardBorderWidth'
> & {
  background: { active: 'solid' | 'gradient'; solid?: BackgroundConfig['solid']; gradient?: BackgroundConfig['gradient'] };
};

export interface ThemePreset {
  id: string;
  /** 日本語の原文。描画時に t() で訳す */
  label: string;
  theme: PresetTheme;
}

/**
 * 「見た目」パネル先頭のワンクリックテーマ。
 * 以前は色・カードの濃さ・ぼかし・角丸などを1つずつ調整するしかなく、
 * 項目の多さが「設定が複雑」という印象の主因になっていた。まず全体の雰囲気を
 * プリセットで選び、細部だけを「詳細設定」で詰める流れにしている。
 */
export const THEME_PRESETS: ReadonlyArray<ThemePreset> = [
  {
    id: 'default',
    label: '標準',
    theme: {
      background: { active: 'gradient', gradient: DEFAULT_THEME.background.gradient },
      textColor: DEFAULT_THEME.textColor,
      accentColor: DEFAULT_THEME.accentColor,
      cardColor: DEFAULT_THEME.cardColor,
      cardOpacity: DEFAULT_THEME.cardOpacity,
      cardBlur: DEFAULT_THEME.cardBlur,
      cardRadius: DEFAULT_THEME.cardRadius,
      cardBorderWidth: DEFAULT_THEME.cardBorderWidth,
    },
  },
  {
    id: 'midnight',
    label: 'ミッドナイト',
    theme: {
      background: { active: 'gradient', gradient: { from: '#0f1b33', to: '#05070d', angle: 160 } },
      textColor: '#e6edf7',
      accentColor: '#5ea8ff',
      cardColor: '#9cc2ff',
      cardOpacity: 0.3,
      cardBlur: 18,
      cardRadius: 16,
      cardBorderWidth: 1,
    },
  },
  {
    id: 'forest',
    label: 'フォレスト',
    theme: {
      background: { active: 'gradient', gradient: { from: '#1d2b22', to: '#0b120e', angle: 150 } },
      textColor: '#e8efe6',
      accentColor: '#7fcf8e',
      cardColor: '#ffffff',
      cardOpacity: 0.3,
      cardBlur: 14,
      cardRadius: 14,
      cardBorderWidth: 1,
    },
  },
  {
    id: 'sunset',
    label: 'サンセット',
    theme: {
      background: { active: 'gradient', gradient: { from: '#4a1f3d', to: '#f08a5d', angle: 135 } },
      textColor: '#fff4ec',
      accentColor: '#ffd166',
      cardColor: '#ffffff',
      cardOpacity: 0.45,
      cardBlur: 20,
      cardRadius: 22,
      cardBorderWidth: 1,
    },
  },
  {
    id: 'mono',
    label: 'モノクロ',
    theme: {
      background: { active: 'solid', solid: { color: '#111111' } },
      textColor: '#f2f2f2',
      accentColor: '#ffffff',
      cardColor: '#ffffff',
      cardOpacity: 0.25,
      cardBlur: 0,
      cardRadius: 6,
      cardBorderWidth: 1,
    },
  },
  {
    id: 'paper',
    label: 'ペーパー',
    theme: {
      background: { active: 'solid', solid: { color: '#f3efe6' } },
      textColor: '#2b2620',
      accentColor: '#c4572a',
      cardColor: '#ffffff',
      cardOpacity: 1,
      cardBlur: 0,
      cardRadius: 12,
      cardBorderWidth: 1,
    },
  },
  {
    id: 'sky',
    label: 'スカイ',
    theme: {
      background: { active: 'gradient', gradient: { from: '#dbeafe', to: '#f8fafc', angle: 180 } },
      textColor: '#1e293b',
      accentColor: '#2563eb',
      cardColor: '#ffffff',
      cardOpacity: 0.9,
      cardBlur: 12,
      cardRadius: 18,
      cardBorderWidth: 1,
    },
  },
];

/**
 * プリセットを現在のテーマに重ねるパッチ。背景は active と該当モードの値だけを差し替え、
 * 他モード（特にアップロード済みの画像）は BackgroundConfig にそのまま残す。
 * 背景エディタのタブで画像へ戻せば、プリセット適用前の画像がそのまま使える。
 */
export function presetPatch(preset: ThemePreset, current: ThemeConfig): Partial<ThemeConfig> {
  const { background, ...rest } = preset.theme;
  return {
    ...rest,
    background: {
      ...current.background,
      active: background.active,
      ...(background.solid ? { solid: background.solid } : {}),
      ...(background.gradient ? { gradient: background.gradient } : {}),
    },
  };
}

/** プレビュー用の背景CSS */
export function presetBackgroundCss(preset: ThemePreset): string {
  const bg = preset.theme.background;
  if (bg.active === 'gradient' && bg.gradient) {
    return `linear-gradient(${bg.gradient.angle}deg, ${bg.gradient.from}, ${bg.gradient.to})`;
  }
  return bg.solid?.color ?? '#000';
}

const COMPARED_KEYS = ['textColor', 'accentColor', 'cardColor', 'cardOpacity', 'cardBlur', 'cardRadius', 'cardBorderWidth'] as const;

/** 現在のテーマがこのプリセットのままか（選択中の表示に使う） */
export function isPresetActive(preset: ThemePreset, current: ThemeConfig): boolean {
  const p = preset.theme;
  const bg = current.background;
  if (bg.active !== p.background.active) return false;
  const g = p.background.gradient;
  if (g && (bg.gradient.from !== g.from || bg.gradient.to !== g.to || bg.gradient.angle !== g.angle)) return false;
  if (p.background.solid && bg.solid.color !== p.background.solid.color) return false;
  return COMPARED_KEYS.every((k) => current[k] === p[k]);
}
