import { useRef } from 'react';
import { Plus, X } from 'lucide-react';

import { cx } from '@/lib/cx';

import styles from './image-list-field.module.css';

interface ImageListFieldProps {
  value: unknown;
  onChange: (value: string[]) => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('画像の読み込みに失敗しました'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(file);
  });
}

/**
 * 複数画像のアップロード欄（widgets/types.ts の FieldSchema kind:'imageList'）。
 *
 * フォルダを直接参照する仕組み（File System Access API 等）は実装していない。
 * 選び直すたびに許可を求められる・拡張機能の再起動で権限が切れるなど扱いが
 * 複雑になるため、背景画像アップロードと同じ「選んだ画像を dataURL として
 * 保存する」方式に寄せている。複数枚まとめて選択できるので、実質的には
 * 「フォルダの中身をまとめて登録する」のとほぼ同じ手間で使える。
 */
export function ImageListField({ value, onChange }: ImageListFieldProps) {
  const images = Array.isArray(value) ? (value.filter((v) => typeof v === 'string') as string[]) : [];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList): Promise<void> => {
    const dataUrls = await Promise.all([...files].map(readAsDataUrl));
    onChange([...images, ...dataUrls]);
  };

  return (
    <div className={styles.root}>
      {images.length > 0 && (
        <div className={styles.grid}>
          {images.map((src, index) => (
            <div
              // 並べ替えはできず、削除で位置が詰まるだけなのでキーは位置で十分
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className={styles.thumbWrap}
            >
              <img className={styles.thumb} src={src} alt="" />
              <button
                type="button"
                className={cx(styles.removeButton, 'ant-no-drag')}
                title="削除"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className={styles.addButton}
        onClick={() => fileInputRef.current?.click()}
      >
        <Plus size={14} /> 画像を追加
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          const { files } = e.target;
          if (files && files.length > 0) void handleFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
