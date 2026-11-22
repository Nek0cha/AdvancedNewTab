import { Check } from 'lucide-react';

import { cx } from '@/lib/cx';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { isPresetActive, presetBackgroundCss, presetPatch, THEME_PRESETS } from '@/lib/theme-presets';

import styles from './theme-preset-picker.module.css';

/** 「見た目」パネル先頭のテーマプリセット一覧。各タイルは背景・カード・文字・アクセントの縮図 */
export function ThemePresetPicker() {
  const t = useT();
  const theme = useAppStore((s) => s.state.theme);
  const patchTheme = useAppStore((s) => s.patchTheme);

  return (
    <div className={styles.grid}>
      {THEME_PRESETS.map((preset) => {
        const active = isPresetActive(preset, theme);
        const p = preset.theme;
        return (
          <button
            key={preset.id}
            type="button"
            className={cx(styles.tile, active && styles.active)}
            aria-pressed={active}
            onClick={() => patchTheme(presetPatch(preset, theme))}
          >
            <span className={styles.preview} style={{ background: presetBackgroundCss(preset) }}>
              <span
                className={styles.card}
                style={{
                  borderRadius: Math.min(p.cardRadius, 8),
                  background: `color-mix(in srgb, ${p.cardColor} ${Math.round(Math.min(p.cardOpacity, 1) * 45)}%, transparent)`,
                }}
              >
                <span className={styles.line} style={{ background: p.textColor }} />
                <span className={styles.dot} style={{ background: p.accentColor }} />
              </span>
              {active && (
                <span className={styles.check}>
                  <Check size={12} />
                </span>
              )}
            </span>
            <span className={styles.label}>{t(preset.label)}</span>
          </button>
        );
      })}
    </div>
  );
}
