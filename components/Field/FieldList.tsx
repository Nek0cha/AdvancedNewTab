import { isFieldVisible, type FieldSchema } from '@/widgets/types';

import { Field } from './Field';
import styles from './field-list.module.css';

interface FieldListProps {
  schema: ReadonlyArray<FieldSchema>;
  /** 同じ階層のフィールドの現在値をまとめたオブジェクト（settings や theme）。 */
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** Field の React key に付与する接頭辞（ウィジェット設定パネルが instanceId を使うのと同じ理由） */
  keyPrefix?: string;
}

function isTabsSelect(schema: FieldSchema): boolean {
  return schema.kind === 'select' && schema.variant === 'tabs';
}

/**
 * FieldSchema の配列を描画する共通コンポーネント。ThemeSettingsPanel と
 * WidgetSettingsPanel の両方から使う（以前はそれぞれが同じ map 処理を個別に持っていた）。
 *
 * 「タブ切り替え（kind:'select', variant:'tabs'）＋ visibleWhen でその値のときだけ出る
 * フィールド」という組み合わせを自動検出し、枠線付きの箱にひとまとめにして描画する。
 * 以前はタブと条件表示フィールドがそれぞれ独立した行として並んでいたため、「このオプションは
 * どのタブに属するものか」が見た目だけでは分かりにくいというフィードバックがあった。
 *
 * グループ化は「同じ key を visibleWhen.key に持つフィールドをスキーマ全体から探して
 * まとめる」方式（タブのすぐ後ろに並んでいる前提にしない）。widgets/countdown のように
 * タブと連動フィールドの間に無関係なフィールド（タイトル欄など）が挟まっていても、
 * 連動フィールドは正しくタブの箱の中へ移動して描画される。
 */
export function FieldList({ schema, values, onChange, keyPrefix }: FieldListProps) {
  const mkKey = (key: string): string => (keyPrefix ? `${keyPrefix}:${key}` : key);

  // タブのグループに属するフィールドの key を先に集めておき、通常描画からは除外する。
  const consumedKeys = new Set<string>();
  for (const field of schema) {
    if (!isTabsSelect(field)) continue;
    for (const other of schema) {
      if (other !== field && other.visibleWhen?.key === field.key) consumedKeys.add(other.key);
    }
  }

  return (
    <>
      {schema.map((field) => {
        if (consumedKeys.has(field.key)) return null; // グループの箱の中で描画済み
        if (!isFieldVisible(field, values)) return null;

        if (!isTabsSelect(field)) {
          return (
            <Field
              key={mkKey(field.key)}
              schema={field}
              value={values[field.key]}
              onChange={(value) => onChange(field.key, value)}
            />
          );
        }

        const children = schema.filter((f) => f.visibleWhen?.key === field.key);
        if (children.length === 0) {
          return (
            <Field
              key={mkKey(field.key)}
              schema={field}
              value={values[field.key]}
              onChange={(value) => onChange(field.key, value)}
            />
          );
        }

        return (
          <div key={mkKey(field.key)} className={styles.group}>
            <Field schema={field} value={values[field.key]} onChange={(value) => onChange(field.key, value)} />
            {children
              .filter((child) => isFieldVisible(child, values))
              .map((child) => (
                <Field
                  key={mkKey(child.key)}
                  schema={child}
                  value={values[child.key]}
                  onChange={(value) => onChange(child.key, value)}
                />
              ))}
          </div>
        );
      })}
    </>
  );
}
