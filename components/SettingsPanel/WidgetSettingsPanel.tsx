import { useState } from 'react';

import { useT } from '@/lib/i18n';
import { FieldList } from '@/components/Field/FieldList';
import { cx } from '@/lib/cx';
import { useAppStore } from '@/lib/store';
import type { ThemeConfig } from '@/lib/types';
import { backgroundModeSwitchPatch, widgetBackgroundFields } from '@/lib/widget-background';
import { accentModeSwitchPatch, subAccentModeSwitchPatch, textModeSwitchPatch, widgetTextFields } from '@/lib/widget-style';
import { getWidgetDef } from '@/widgets/registry';

import { WidgetStyleCode } from './WidgetStyleCode';
import tabStyles from './background-editor.module.css';
import styles from './widget-settings-header.module.css';

/**
 * 全ウィジェット共通の見た目系フィールドのキー。
 * 以前はウィジェット固有の項目と同じ一覧に並べていたため、共通の見た目項目（10個以上）に
 * 「24時間表示」のような本題の設定が埋もれてしまっていた。キーで「内容」「見た目」の
 * タブへ振り分ける。共通フィールド定義から導出するので、ウィジェットを足しても
 * ここを編集する必要はない。
 */
const STYLE_KEYS = new Set(
  [...widgetTextFields(), ...widgetBackgroundFields({ border: true })].map((f) => f.key),
);

type SettingsTab = 'content' | 'style';

interface WidgetSettingsPanelProps {
  instanceId: string;
}

/**
 * 「既定」から「個別に指定」へ切り替えた瞬間に、値欄へ実際に注入する追加パッチを返す
 * フィールドキーの一覧。default→custom への切り替わりの瞬間だけ、今のテーマの実効値を
 * 初期値としてコピーする（そうしないと色欄が固定の既定値＝白系から始まり、
 * 「個別に指定を押したら急に白くなる」という体験になってしまう）。
 */
function modeSwitchPatch(key: string, theme: ThemeConfig): Record<string, unknown> | null {
  switch (key) {
    case 'backgroundMode':
      return backgroundModeSwitchPatch(theme);
    case 'textMode':
      return textModeSwitchPatch(theme);
    case 'accentMode':
      return accentModeSwitchPatch(theme);
    case 'subAccentMode':
      return subAccentModeSwitchPatch(theme);
    default:
      return null;
  }
}

/**
 * ウィジェット個別の設定フォーム。
 * WidgetDef.settingsSchema をそのまま描画するだけなので、
 * ウィジェットが増えてもこのファイルを触る必要はない。
 */
export function WidgetSettingsPanel({ instanceId }: WidgetSettingsPanelProps) {
  const instance = useAppStore((s) => s.state.widgets[instanceId]);
  const theme = useAppStore((s) => s.state.theme);
  const patchWidgetSettings = useAppStore((s) => s.patchWidgetSettings);
  const [tab, setTab] = useState<SettingsTab>('content');
  const t = useT();

  const def = instance ? getWidgetDef(instance.type) : undefined;
  if (!instance || !def) {
    return <p>{t('このウィジェットは見つかりませんでした。')}</p>;
  }

  const settings = { ...def.defaultSettings, ...instance.settings };

  const handleFieldChange = (key: string, value: unknown): void => {
    const patch: Record<string, unknown> = { [key]: value };
    // 'default' → 'custom' への切り替わりの瞬間だけ、今のテーマの実効値をコピーする。
    if (value === 'custom' && settings[key] !== 'custom') {
      const extra = modeSwitchPatch(key, theme);
      if (extra) Object.assign(patch, extra);
    }
    patchWidgetSettings(instanceId, patch);
  };

  const contentSchema = def.settingsSchema.filter((f) => !STYLE_KEYS.has(f.key));
  const styleSchema = def.settingsSchema.filter((f) => STYLE_KEYS.has(f.key));
  // 片方しか項目が無いウィジェットではタブ自体を出さない（空のタブを押させない）
  const showTabs = contentSchema.length > 0 && styleSchema.length > 0;
  const activeTab: SettingsTab = showTabs ? tab : contentSchema.length > 0 ? 'content' : 'style';

  return (
    <>
      <div className={styles.header}>
        <span className={styles.iconWrap}>
          <def.icon size={18} />
        </span>
        <span className={styles.name}>{t(def.name)}</span>
      </div>
      {/*
        key に instanceId を含めるのは FieldList 内部の Field/NumberStepper 等が持つ
        ローカル入力状態（draft）対策。WidgetSettingsPanel はウィジェットを切り替えても
        同じコンポーネントインスタンスのまま instanceId だけが変わるため、
        instanceId を含めないと切り替え直後の1フレームだけ前のウィジェットの値が
        一瞬表示されてから正しい値に直る、という不具合が起きる。
      */}
      {showTabs && (
        <div className={tabStyles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'content'}
            className={cx(tabStyles.tab, activeTab === 'content' && tabStyles.tabActive)}
            onClick={() => setTab('content')}
          >
            {t('内容')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'style'}
            className={cx(tabStyles.tab, activeTab === 'style' && tabStyles.tabActive)}
            onClick={() => setTab('style')}
          >
            {t('見た目')}
          </button>
        </div>
      )}
      {activeTab === 'content' ? (
        <FieldList schema={contentSchema} values={settings} onChange={handleFieldChange} keyPrefix={instanceId} />
      ) : (
        <>
          <FieldList schema={styleSchema} values={settings} onChange={handleFieldChange} keyPrefix={instanceId} />
          <WidgetStyleCode
            settings={settings}
            onApply={(patch) => patchWidgetSettings(instanceId, patch)}
          />
        </>
      )}
    </>
  );
}
