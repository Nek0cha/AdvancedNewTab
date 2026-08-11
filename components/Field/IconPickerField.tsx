import { useRef } from 'react';
import { Upload } from 'lucide-react';

import { cx } from '@/lib/cx';
import { normalizeIconValue, svgToDataUrl, tintSvgCode, type IconValue } from '@/lib/icon-value';
import { LINK_ICON_OPTIONS } from '@/lib/link-icons';

/**
 * SVGプレビューに適用する固定色。
 *
 * <img> はページのCSS（currentColorの継承）が一切効かない独立した描画コンテキストのため、
 * currentColor を使ったSVG（Iconify系のアイコンはほぼすべてこの形式）をそのままプレビューに
 * 出すと、色の初期値である黒として描画され潰れて見えなくなる（lib/icon-value.ts 参照）。
 * アプリが常時ダークテーマである前提で、判読できる明るい色に固定でtintする。
 */
const PREVIEW_TINT_COLOR = '#f1ecec';

import backgroundEditorStyles from '../SettingsPanel/background-editor.module.css';
import fieldStyles from './field.module.css';
import styles from './icon-picker-field.module.css';

interface IconPickerFieldProps {
  value: unknown;
  onChange: (value: IconValue) => void;
}

const TABS: ReadonlyArray<{ source: IconValue['source']; label: string }> = [
  { source: 'default', label: '既定' },
  { source: 'lucide', label: 'アイコン' },
  { source: 'image', label: '画像' },
  { source: 'svg', label: 'SVG' },
  { source: 'url', label: 'URL' },
];

/**
 * リンクごとのアイコンを選ぶフィールド。
 *
 * 「未設定なら自動でfaviconを使う」を既定にしつつ、lucideアイコン・画像アップロード・
 * SVGコード貼り付け・外部URL指定のいずれかに切り替えられる。BackgroundEditor と
 * 同じタブ切り替えパターンを踏襲している。
 */
export function IconPickerField({ value, onChange }: IconPickerFieldProps) {
  const current = normalizeIconValue(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onChange({ source: 'image', dataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className={backgroundEditorStyles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.source}
            type="button"
            className={cx(
              backgroundEditorStyles.tab,
              current.source === tab.source && backgroundEditorStyles.tabActive,
            )}
            onClick={() => {
              if (tab.source === 'default') onChange({ source: 'default' });
              else if (tab.source === 'lucide') onChange({ source: 'lucide', id: LINK_ICON_OPTIONS[0]!.id });
              else if (tab.source === 'image') onChange({ source: 'image', dataUrl: '' });
              else if (tab.source === 'svg') onChange({ source: 'svg', code: '' });
              else onChange({ source: 'url', url: '' });
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {current.source === 'default' && (
        <p className={fieldStyles.help}>サイトのfaviconを自動で表示します。</p>
      )}

      {current.source === 'lucide' && (
        <div className={styles.iconGrid}>
          {LINK_ICON_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              title={option.label}
              className={cx(styles.iconOption, current.id === option.id && styles.iconOptionActive)}
              onClick={() => onChange({ source: 'lucide', id: option.id })}
            >
              <option.Icon size={18} />
            </button>
          ))}
        </div>
      )}

      {current.source === 'image' && (
        <>
          {current.dataUrl && (
            <div className={styles.previewRow}>
              <img className={styles.previewThumb} src={current.dataUrl} alt="" />
            </div>
          )}
          <button
            type="button"
            className={backgroundEditorStyles.fileButton}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} /> 画像をアップロード
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageFile(file);
              e.target.value = '';
            }}
          />
        </>
      )}

      {current.source === 'svg' && (
        <>
          <textarea
            className={cx(fieldStyles.control, fieldStyles.textarea)}
            rows={4}
            placeholder="<svg>...</svg>"
            value={current.code}
            onChange={(e) => onChange({ source: 'svg', code: e.target.value })}
          />
          {current.code && (
            <div className={styles.previewRow}>
              <img
                className={styles.previewThumb}
                src={svgToDataUrl(tintSvgCode(current.code, PREVIEW_TINT_COLOR))}
                alt=""
              />
            </div>
          )}
        </>
      )}

      {current.source === 'url' && (
        <>
          <input
            type="text"
            className={fieldStyles.control}
            placeholder="https://example.com/icon.png"
            value={current.url}
            onChange={(e) => onChange({ source: 'url', url: e.target.value })}
          />
          <span className={fieldStyles.help}>外部の画像URLを直接指定します（通信が発生します）。</span>
        </>
      )}
    </>
  );
}
