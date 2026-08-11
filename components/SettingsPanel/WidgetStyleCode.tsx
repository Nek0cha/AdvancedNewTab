import { useState } from 'react';
import { Check, Clipboard, ClipboardPaste } from 'lucide-react';

import { decodeStyleCode, encodeStyleCode } from '@/lib/widget-style-code';

import panelStyles from './settings-section.module.css';
import styles from './widget-style-code.module.css';

interface WidgetStyleCodeProps {
  /** マージ済みの現在の設定値（defaultSettings + instance.settings）。 */
  settings: Record<string, unknown>;
  /** 貼り付けたコードを読み取れたときに呼ばれる。呼び出し側で patchWidgetSettings する。 */
  onApply: (patch: Record<string, unknown>) => void;
}

/**
 * ウィジェットの個別スタイル（背景・文字色・サブアクセントカラー・太さ）を短いコードとして
 * コピー＆貼り付けし、複数のウィジェットへ同じ見た目を一括反映するためのUI。
 * lib/widget-style-code.ts が実際のエンコード/デコードを担う。
 */
export function WidgetStyleCode({ settings, onApply }: WidgetStyleCodeProps) {
  const [copied, setCopied] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(encodeStyleCode(settings));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('クリップボードにコピーできませんでした。');
    }
  };

  const handleApply = (): void => {
    const decoded = decodeStyleCode(pasteValue);
    if (!decoded) {
      setError('コードを読み取れませんでした。コピーしたコードをそのまま貼り付けてください。');
      return;
    }
    setError(null);
    onApply(decoded);
    setPasteValue('');
  };

  return (
    <section className={panelStyles.section}>
      <h3 className={panelStyles.sectionTitle}>スタイルをコピー</h3>
      <p className={styles.help}>
        背景・文字色・サブアクセントカラー・太さの個別設定をコードとしてコピーし、
        別のウィジェットの貼り付け欄に入れて「適用」すると、同じ見た目を一括で反映できます。
      </p>
      <button type="button" className={styles.button} onClick={() => void handleCopy()}>
        {copied ? <Check size={14} /> : <Clipboard size={14} />}
        {copied ? 'コピーしました' : 'スタイルをコピー'}
      </button>
      <div className={styles.pasteRow}>
        <input
          type="text"
          className={styles.pasteInput}
          placeholder="コードを貼り付け"
          value={pasteValue}
          onChange={(e) => {
            setPasteValue(e.target.value);
            setError(null);
          }}
        />
        <button
          type="button"
          className={styles.button}
          disabled={!pasteValue.trim()}
          onClick={handleApply}
        >
          <ClipboardPaste size={14} />
          適用
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}
