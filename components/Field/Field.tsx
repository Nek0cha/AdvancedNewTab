import { useId } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

import { ColorPicker } from '@/components/ColorPicker/ColorPicker';
import { Dropdown } from '@/components/Dropdown/Dropdown';
import { NumberStepper } from '@/components/NumberStepper/NumberStepper';
import { cx } from '@/lib/cx';
import { DEFAULT_ICON_VALUE } from '@/lib/icon-value';
import { isFieldVisible, type FieldSchema, type ListPreset } from '@/widgets/types';

import { AddWithPresets } from './AddWithPresets';
import { IconPickerField } from './IconPickerField';
import { ImageListField } from './ImageListField';
import styles from './field.module.css';
import tabStyles from '../SettingsPanel/background-editor.module.css';

interface FieldProps {
  schema: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

/** itemFields の宣言から、リストに追加する新規項目の初期値を組み立てる。 */
function createEmptyItem(fields: ReadonlyArray<FieldSchema>): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field.kind) {
      case 'number':
        item[field.key] = field.min ?? 0;
        break;
      case 'toggle':
        item[field.key] = false;
        break;
      case 'select':
        item[field.key] = field.options[0]?.value ?? '';
        break;
      case 'color':
        item[field.key] = '#888888';
        break;
      case 'icon':
        item[field.key] = DEFAULT_ICON_VALUE;
        break;
      case 'list':
      case 'imageList':
        item[field.key] = [];
        break;
      default:
        item[field.key] = '';
    }
  }
  return item;
}

/**
 * FieldSchema 1件を入力欄として描画する。
 *
 * ウィジェット側もテーマ設定側もこのコンポーネントを共有するため、
 * 設定項目を増やすときにフォームのJSXを書く必要がない。
 */
export function Field({ schema, value, onChange }: FieldProps) {
  const id = useId();

  if (schema.kind === 'toggle') {
    const checked = Boolean(value);
    return (
      <div className={styles.toggleRow}>
        <label className={styles.label} htmlFor={id}>
          {schema.label}
        </label>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          className={cx(styles.switch, checked && styles.switchOn)}
          onClick={() => onChange(!checked)}
        />
      </div>
    );
  }

  if (schema.kind === 'list') {
    const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

    const replace = (next: Record<string, unknown>[]): void => onChange(next);

    return (
      <div className={styles.field}>
        <span className={styles.label}>{schema.label}</span>
        {schema.help && <span className={styles.help}>{schema.help}</span>}

        {items.length === 0 ? (
          <div className={styles.empty}>まだ項目がありません</div>
        ) : (
          <div className={styles.listItems}>
            {items.map((item, index) => (
              // 並べ替えと削除で位置が入れ替わるだけなので、キーは位置で十分
              // eslint-disable-next-line react/no-array-index-key
              <div key={index} className={styles.listItem}>
                <div className={styles.listItemHeader}>
                  <span className={styles.listItemIndex}>{index + 1}</span>
                  <button
                    type="button"
                    className={styles.miniButton}
                    title="上へ"
                    disabled={index === 0}
                    onClick={() => {
                      const next = [...items];
                      const [moved] = next.splice(index, 1);
                      if (moved) next.splice(index - 1, 0, moved);
                      replace(next);
                    }}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className={styles.miniButton}
                    title="下へ"
                    disabled={index === items.length - 1}
                    onClick={() => {
                      const next = [...items];
                      const [moved] = next.splice(index, 1);
                      if (moved) next.splice(index + 1, 0, moved);
                      replace(next);
                    }}
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    type="button"
                    className={styles.miniButton}
                    title="削除"
                    onClick={() => replace(items.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {schema.itemFields
                  .filter((itemField) => isFieldVisible(itemField, item))
                  .map((itemField) => (
                    <Field
                      key={itemField.key}
                      schema={itemField}
                      value={item[itemField.key]}
                      onChange={(fieldValue) => {
                        const next = [...items];
                        next[index] = { ...item, [itemField.key]: fieldValue };
                        replace(next);
                      }}
                    />
                  ))}
              </div>
            ))}
          </div>
        )}

        {(schema.maxItems === undefined || items.length < schema.maxItems) &&
          (schema.presets && schema.presets.length > 0 ? (
            <AddWithPresets
              addLabel={schema.addLabel ?? '追加'}
              presets={schema.presets}
              onAddBlank={() => replace([...items, createEmptyItem(schema.itemFields)])}
              onAddPreset={(preset: ListPreset) => replace([...items, { ...preset.value }])}
            />
          ) : (
            <button
              type="button"
              className={styles.addButton}
              onClick={() => replace([...items, createEmptyItem(schema.itemFields)])}
            >
              <Plus size={14} /> {schema.addLabel ?? '追加'}
            </button>
          ))}
        {schema.maxItems !== undefined && items.length >= schema.maxItems && (
          <span className={styles.help}>最大{schema.maxItems}件まで登録できます。</span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {schema.label}
      </label>

      {schema.kind === 'text' && (
        <input
          id={id}
          type="text"
          className={styles.control}
          value={typeof value === 'string' ? value : ''}
          placeholder={schema.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {schema.kind === 'textarea' && (
        <textarea
          id={id}
          className={cx(styles.control, styles.textarea)}
          rows={schema.rows ?? 4}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {schema.kind === 'number' && (
        <NumberStepper
          id={id}
          value={typeof value === 'number' ? value : (schema.min ?? 0)}
          min={schema.min}
          max={schema.max}
          step={schema.step}
          onChange={onChange}
        />
      )}

      {schema.kind === 'select' && schema.variant === 'tabs' && (
        <div className={tabStyles.tabs}>
          {schema.options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cx(tabStyles.tab, value === option.value && tabStyles.tabActive)}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {schema.kind === 'select' && schema.variant !== 'tabs' && (
        <Dropdown
          id={id}
          value={typeof value === 'string' ? value : ''}
          options={schema.options}
          onChange={onChange}
        />
      )}

      {schema.kind === 'color' && (
        <ColorPicker
          id={id}
          value={typeof value === 'string' ? value : '#000000'}
          onChange={onChange}
        />
      )}

      {schema.kind === 'icon' && <IconPickerField value={value} onChange={onChange} />}

      {schema.kind === 'imageList' && <ImageListField value={value} onChange={onChange} />}

      {schema.help && <span className={styles.help}>{schema.help}</span>}
    </div>
  );
}
