import { Field } from '@/components/Field/Field';
import { useAppStore } from '@/lib/store';
import { THEME_SCHEMA } from '@/lib/theme-schema';
import type { ThemeConfig } from '@/lib/types';
import { isFieldVisible } from '@/widgets/types';

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
        {THEME_SCHEMA.filter((schema) =>
          isFieldVisible(schema, theme as unknown as Record<string, unknown>),
        ).map((schema) => (
          <Field
            key={schema.key}
            schema={schema}
            value={theme[schema.key as keyof ThemeConfig]}
            onChange={(value) => patchTheme({ [schema.key]: value } as Partial<ThemeConfig>)}
          />
        ))}
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
