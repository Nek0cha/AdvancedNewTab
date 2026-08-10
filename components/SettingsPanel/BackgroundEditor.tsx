import { useRef } from 'react';
import { Upload } from 'lucide-react';

import { ColorPicker } from '@/components/ColorPicker/ColorPicker';
import { NumberStepper } from '@/components/NumberStepper/NumberStepper';
import { cx } from '@/lib/cx';
import type { BackgroundConfig } from '@/lib/types';

import styles from './background-editor.module.css';
import fieldStyles from '../Field/field.module.css';

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
          単色
        </button>
        <button
          type="button"
          className={cx(styles.tab, value.active === 'gradient' && styles.tabActive)}
          onClick={() => onChange({ ...value, active: 'gradient' })}
        >
          グラデーション
        </button>
        <button
          type="button"
          className={cx(styles.tab, value.active === 'image' && styles.tabActive)}
          onClick={() => onChange({ ...value, active: 'image' })}
        >
          画像
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
            <span className={styles.arrow}>→</span>
            <ColorPicker
              value={value.gradient.to}
              onChange={(to) => onChange({ ...value, gradient: { ...value.gradient, to } })}
            />
          </div>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label}>角度</label>
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
            <Upload size={15} /> 画像をアップロード
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
            <label className={fieldStyles.label}>外部URLを直接指定</label>
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
              外部サイトの画像を使う場合、そのサイトへの通信が発生します。
            </span>
          </div>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label}>下地の色（画像読み込み前・失敗時）</label>
            <ColorPicker
              value={value.image.fallbackColor}
              onChange={(fallbackColor) =>
                onChange({ ...value, image: { ...value.image, fallbackColor } })
              }
            />
          </div>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label}>ぼかし（px）</label>
            <NumberStepper
              value={value.image.blur}
              min={0}
              max={40}
              onChange={(blur) => onChange({ ...value, image: { ...value.image, blur } })}
            />
          </div>
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label}>暗さ（0〜1）</label>
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
