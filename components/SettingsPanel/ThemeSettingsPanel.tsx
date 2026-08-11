import { FieldList } from '@/components/Field/FieldList';
import { useAppStore } from '@/lib/store';
import { THEME_SCHEMA } from '@/lib/theme-schema';
import type { ThemeConfig } from '@/lib/types';

import { AboutSection } from './AboutSection';
import { BackgroundEditor } from './BackgroundEditor';
import { FontEditor } from './FontEditor';
import { LayoutPresetsEditor } from './LayoutPresetsEditor';
import panelStyles from './settings-section.module.css';

/** グローバルなテーマ・レイアウト密度の設定フォーム。 */
export function ThemeSettingsPanel() {
  const theme = useAppStore((s) => s.state.theme);
  const patchTheme = useAppStore((s) => s.patchTheme);

  return (
    <>
      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>背景</h3>
        <BackgroundEditor
          value={theme.background}
          onChange={(background) => patchTheme({ background })}
        />
      </section>

      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>フォント</h3>
        <FontEditor
          canvasFontId={theme.canvasFontId}
          customFont={theme.customFont}
          onChange={(patch) => patchTheme(patch)}
        />
      </section>

      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>表示</h3>
        <FieldList
          schema={THEME_SCHEMA}
          values={theme as unknown as Record<string, unknown>}
          onChange={(key, value) => patchTheme({ [key]: value } as Partial<ThemeConfig>)}
        />
      </section>

      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>レイアウト保存</h3>
        <LayoutPresetsEditor />
      </section>

      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>このアプリについて</h3>
        <AboutSection />
      </section>
    </>
  );
}
