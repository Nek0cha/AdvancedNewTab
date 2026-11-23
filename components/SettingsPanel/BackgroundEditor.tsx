import { useRef } from 'react';
import { ArrowRight, Upload } from 'lucide-react';

import { useT } from '@/lib/i18n';
import { ColorPicker } from '@/components/ColorPicker/ColorPicker';
import { NumberStepper } from '@/components/NumberStepper/NumberStepper';
import { cx } from '@/lib/cx';
import { Field } from '@/components/Field/Field';
import type { BackgroundConfig, BackgroundSlideshow } from '@/lib/types';
import { isFieldVisible, type FieldSchema } from '@/widgets/types';

import styles from './background-editor.module.css';
import fieldStyles from '../Field/field.module.css';

/**
 * スライドショーの設定欄。入力欄は Field（スキーマ駆動のフォーム）をそのまま使う。
 * ウィジェット設定と同じ見た目・操作感になり、画像の追加・削除も widgets/image と同じ部品で済む。
 */
const SLIDESHOW_FIELDS: ReadonlyArray<FieldSchema> = [
  { kind: 'toggle', key: 'enabled', label: 'スライドショー' },
  {
    kind: 'imageList',
    key: 'images',
    label: '切り替える画像',
    help: '有効にしている間は、上の画像の代わりにここの画像を順に表示します。',
    visibleWhen: { key: 'enabled', equals: true },
  },
  {
    kind: 'select',
    key: 'intervalMinutes',
    label: '切り替える間隔',
    options: [
      { value: '0', label: '新しいタブを開くたび' },
      { value: '5', label: '5分ごと' },
      { value: '15', label: '15分ごと' },
      { value: '30', label: '30分ごと' },
      { value: '60', label: '1時間ごと' },
      { value: '360', label: '6時間ごと' },
      { value: '1440', label: '1日ごと' },
    ],
    visibleWhen: { key: 'enabled', equals: true },
  },
  { kind: 'toggle', key: 'shuffle', label: 'ランダムな順番にする', visibleWhen: { key: 'enabled', equals: true } },
];

function SlideshowFields({
  value,
  onChange,
}: {
  value: BackgroundSlideshow;
  onChange: (value: BackgroundSlideshow) => void;
}) {
  // select は文字列でしか値を持てないため、間隔だけ表示用に文字列へ変換して渡し、戻すときに数値へ直す
  const values: Record<string, unknown> = { ...value, intervalMinutes: String(value.intervalMinutes) };
  return (
    <>
      {SLIDESHOW_FIELDS.filter((schema) => isFieldVisible(schema, values)).map((schema) => (
        <Field
          key={schema.key}
          schema={schema}
          value={values[schema.key]}
          onChange={(next) =>
            onChange({
              ...value,
              [schema.key]: schema.key === 'intervalMinutes' ? Number(next) || 0 : next,
            })
          }
        />
      ))}
    </>
  );
}

interface BackgroundEditorProps {
  value: BackgroundConfig;
  onChange: (value: BackgroundConfig) => void;
}

/**
 * 背景設定の専用エディタ。
 *
 * 単色・グラデーション・画像の3方式を「同時に」保持し、`active` でどれを
 * 使うかだけを切り替える（lib/types.ts の BackgroundConfig 参照）。
 * 以前は type によるユニオン型で1方式分の値しか持てず、タブを切り替えるたびに
 * 前の設定（色や画像）が失われるバグがあった。この形にしたことで、
 * 単色→画像→単色と行き来しても、それぞれ直前に入力した内容のまま残る。
 */
export function BackgroundEditor({ value, onChange }: BackgroundEditorProps) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      onChange({
        ...value,
        active: 'image',
        image: { ...value.image, src: reader.result },
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className={styles.tabs}>
        <button
          type="button"
          className={cx(styles.tab, value.active === 'solid' && styles.tabActive)}
          onClick={() => onChange({ ...value, active: 'solid' })}
        >
          {t('単色')}
        </button>
        <button
          type="button"
          className={cx(styles.tab, value.active === 'gradient' && styles.tabActive)}
          onClick={() => onChange({ ...value, active: 'gradient' })}
        >
          {t('グラデーション')}
        </button>
        <button
          type="button"
          className={cx(styles.tab, value.active === 'image' && styles.tabActive)}
          onClick={() => onChange({ ...value, active: 'image' })}
        >
          {t('画像')}
        </button>
      </div>

      {value.active === 'solid' && (
        <ColorPicker
          value={value.solid.color}
          onChange={(color) => onChange({ ...value, solid: { color } })}
        />
      )}

      {value.active === 'gradient' && (
        <>
          <div
            className={styles.gradientPreview}
            style={{
              background: `linear-gradient(${value.gradient.angle}deg, ${value.gradient.from}, ${value.gradient.to})`,
            }}
          />
          <div className={styles.row}>
            <ColorPicker
              value={value.gradient.from}
              onChange={(from) => onChange({ ...value, gradient: { ...value.gradient, from } })}
            />
            <ArrowRight size={16} className={styles.arrow} aria-hidden />
            <ColorPicker
              value={value.gradient.to}
              onChange={(to) => onChange({ ...value, gradient: { ...value.gradient, to } })}
            />
          </div>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label}>{t('角度')}</label>
            <NumberStepper
              value={value.gradient.angle}
              min={0}
              max={360}
              onChange={(angle) => onChange({ ...value, gradient: { ...value.gradient, angle } })}
            />
          </div>
        </>
      )}

      {value.active === 'image' && (
        <>
          {value.image.src && (
            <div className={styles.thumb} style={{ backgroundImage: `url("${value.image.src}")` }} />
          )}
          <button
            type="button"
            className={styles.fileButton}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={15} /> {t('画像をアップロード')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label}>{t('外部URLを直接指定')}</label>
            <input
              type="text"
              className={fieldStyles.control}
              placeholder="https://..."
              defaultValue={value.image.src.startsWith('data:') ? '' : value.image.src}
              onBlur={(e) => {
                const src = e.target.value.trim();
                if (src) onChange({ ...value, image: { ...value.image, src } });
              }}
            />
            <span className={fieldStyles.help}>
              {t('外部サイトの画像を使う場合、そのサイトへの通信が発生します。')}
            </span>
          </div>
          <SlideshowFields
            value={value.image.slideshow}
            onChange={(slideshow) => onChange({ ...value, image: { ...value.image, slideshow } })}
          />
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label}>{t('下地の色（画像読み込み前・失敗時）')}</label>
            <ColorPicker
              value={value.image.fallbackColor}
              onChange={(fallbackColor) =>
                onChange({ ...value, image: { ...value.image, fallbackColor } })
              }
            />
          </div>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label}>{t('ぼかし（px）')}</label>
            <NumberStepper
              value={value.image.blur}
              min={0}
              max={40}
              onChange={(blur) => onChange({ ...value, image: { ...value.image, blur } })}
            />
          </div>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label}>{t('暗さ（0〜1）')}</label>
            <NumberStepper
              value={value.image.dim}
              min={0}
              max={1}
              step={0.05}
              onChange={(dim) => onChange({ ...value, image: { ...value.image, dim } })}
            />
          </div>
        </>
      )}
    </div>
  );
}
