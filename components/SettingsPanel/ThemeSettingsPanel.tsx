import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { FieldList } from '@/components/Field/FieldList';
import { cx } from '@/lib/cx';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { THEME_SCHEMA } from '@/lib/theme-schema';
import type { ThemeConfig } from '@/lib/types';

import { AboutSection } from './AboutSection';
import { BackgroundEditor } from './BackgroundEditor';
import { BackupSection } from './BackupSection';
import { FontEditor } from './FontEditor';
import { LayoutPresetsEditor } from './LayoutPresetsEditor';
import panelStyles from './settings-section.module.css';
import { ThemePresetPicker } from './ThemePresetPicker';

/**
 * 「基本」に出すテーマ項目。それ以外（文字の太さ・サブアクセント・カードの細部・グリッド寸法）は
 * 「詳細設定」に折りたたむ。以前は13項目を1つの「表示」に並べていたため、どれを触れば
 * 見た目が大きく変わるのか分かりにくかった。大きな変化はプリセットと背景に任せ、
 * ここには言語・タブ名・主要な2色だけを残している。
 */
const BASIC_KEYS = new Set(['locale', 'tabTitle', 'textColor', 'accentColor']);
const BASIC_SCHEMA = THEME_SCHEMA.filter((f) => BASIC_KEYS.has(f.key));
const ADVANCED_SCHEMA = THEME_SCHEMA.filter((f) => !BASIC_KEYS.has(f.key));

/** グローバルなテーマ・レイアウト密度の設定フォーム。 */
export function ThemeSettingsPanel() {
  const t = useT();
  const theme = useAppStore((s) => s.state.theme);
  const patchTheme = useAppStore((s) => s.patchTheme);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const values = theme as unknown as Record<string, unknown>;
  const onFieldChange = (key: string, value: unknown): void => patchTheme({ [key]: value } as Partial<ThemeConfig>);

  return (
    <>
      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>{t('テーマ')}</h3>
        <ThemePresetPicker />
      </section>

      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>{t('背景')}</h3>
        <BackgroundEditor value={theme.background} onChange={(background) => patchTheme({ background })} />
      </section>

      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>{t('基本')}</h3>
        <FieldList schema={BASIC_SCHEMA} values={values} onChange={onFieldChange} />
      </section>

      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>{t('フォント')}</h3>
        <FontEditor
          canvasFontId={theme.canvasFontId}
          customFont={theme.customFont}
          onChange={(patch) => patchTheme(patch)}
        />
      </section>

      <section className={panelStyles.section}>
        <button
          type="button"
          className={panelStyles.disclosure}
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((v) => !v)}
        >
          <span className={panelStyles.sectionTitle}>{t('詳細設定')}</span>
          <span className={panelStyles.disclosureHint}>{t('文字の太さ・カード・グリッドの寸法')}</span>
          <ChevronDown size={14} className={cx(panelStyles.chevron, advancedOpen && panelStyles.chevronOpen)} />
        </button>
        {advancedOpen && (
          <div className={panelStyles.disclosureBody}>
            <FieldList schema={ADVANCED_SCHEMA} values={values} onChange={onFieldChange} />
          </div>
        )}
      </section>

      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>{t('レイアウト保存')}</h3>
        <LayoutPresetsEditor />
      </section>

      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>{t('バックアップ')}</h3>
        <BackupSection />
      </section>

      <section className={panelStyles.section}>
        <h3 className={panelStyles.sectionTitle}>{t('このアプリについて')}</h3>
        <AboutSection />
      </section>
    </>
  );
}
