import { Field } from '@/components/Field/Field';
import { useAppStore } from '@/lib/store';
import { getWidgetDef } from '@/widgets/registry';

import styles from './widget-settings-header.module.css';

interface WidgetSettingsPanelProps {
  instanceId: string;
}

/**
 * ウィジェット個別の設定フォーム。
 * WidgetDef.settingsSchema をそのまま描画するだけなので、
 * ウィジェットが増えてもこのファイルを触る必要はない。
 */
export function WidgetSettingsPanel({ instanceId }: WidgetSettingsPanelProps) {
  const instance = useAppStore((s) => s.state.widgets[instanceId]);
  const patchWidgetSettings = useAppStore((s) => s.patchWidgetSettings);

  const def = instance ? getWidgetDef(instance.type) : undefined;
  if (!instance || !def) {
    return <p>このウィジェットは見つかりませんでした。</p>;
  }

  const settings = { ...def.defaultSettings, ...instance.settings };

  return (
    <>
      <div className={styles.header}>
        <span className={styles.iconWrap}>
          <def.icon size={18} />
        </span>
        <span className={styles.name}>{def.name}</span>
      </div>
      {def.settingsSchema.map((schema) => (
        // key は instanceId も含めて一意にする。schema.key（'fontScale' 等）だけだと、
        // 別ウィジェットの同名フィールドと衝突してしまう。WidgetSettingsPanel は
        // ウィジェットを切り替えても同じコンポーネントインスタンスのまま instanceId
        // だけが変わるため、Field/NumberStepper 等が持つローカル入力状態（draft）を
        // Reactがそのまま使い回し、切り替え直後の1フレームだけ前のウィジェットの値が
        // 一瞬表示されてから正しい値に直る、という不具合が起きていた。
        // instanceId を key に含めることで、切り替え時に確実に作り直させる。
        <Field
          key={`${instanceId}:${schema.key}`}
          schema={schema}
          value={settings[schema.key]}
          onChange={(value) => patchWidgetSettings(instanceId, { [schema.key]: value })}
        />
      ))}
    </>
  );
}
