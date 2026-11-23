import { useRef } from 'react';
import { Upload } from 'lucide-react';

import { useT } from '@/lib/i18n';
import { Dropdown } from '@/components/Dropdown/Dropdown';
import { cx } from '@/lib/cx';
import { FONT_OPTIONS } from '@/lib/fonts';
import type { CustomFont } from '@/lib/types';

import styles from './background-editor.module.css';
import fieldStyles from '../Field/field.module.css';

interface FontEditorProps {
  canvasFontId: string;
  customFont: CustomFont | null;
  onChange: (patch: { canvasFontId: string; customFont: CustomFont | null }) => void;
}

/** アップロードされたファイル名の拡張子から @font-face の format() 引数を決める。 */
function formatFromFileName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'woff2':
      return 'woff2';
    case 'woff':
      return 'woff';
    case 'ttf':
      return 'truetype';
    case 'otf':
      return 'opentype';
    default:
      return 'woff2';
  }
}

/**
 * キャンバス（新規タブ上のウィジェット群）に使うフォントの選択。
 *
 * 自由入力にしていないのは、フォント名の手打ちがタイプミスや未インストールで
 * 静かに失敗しがちなため。「王道フォントから選ぶ」＋「ダメならアップロード」の
 * 二段構えにしている。
 */
export function FontEditor({ canvasFontId, customFont, onChange }: FontEditorProps) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const familyName = `ant-custom-${Date.now().toString(36)}`;
      onChange({
        canvasFontId: 'custom',
        customFont: {
          familyName,
          originalFileName: file.name,
          dataUrl: reader.result,
          format: formatFromFileName(file.name),
        },
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className={fieldStyles.field}>
        <label className={fieldStyles.label} htmlFor="ant-font-select">
          {t('フォント')}
        </label>
        <Dropdown
          id="ant-font-select"
          value={canvasFontId === 'custom' ? '__custom__' : canvasFontId}
          options={[
            ...FONT_OPTIONS.map((f) => ({ value: f.id, label: f.label, style: { fontFamily: f.stack } })),
            ...(customFont
              ? [{ value: '__custom__', label: t('{name}（カスタム）', { name: customFont.originalFileName }) }]
              : []),
          ]}
          onChange={(next) => {
            if (next === '__custom__') return;
            onChange({ canvasFontId: next, customFont });
          }}
        />
      </div>

      <button
        type="button"
        className={styles.fileButton}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={15} /> {t('カスタムフォントをアップロード（.woff2 / .woff / .ttf / .otf）')}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />

      {canvasFontId === 'custom' && customFont && (
        <p
          className={cx(fieldStyles.help)}
          style={{ fontFamily: `'${customFont.familyName}'` }}
        >
          {t('プレビュー: The quick brown fox / あいうえお ({name})', { name: customFont.originalFileName })}
        </p>
      )}
    </div>
  );
}
