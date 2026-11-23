import { useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Download, FolderOpen } from 'lucide-react';

import { useT, type TranslateVars } from '@/lib/i18n';
import { parseImportedState } from '@/lib/storage';
import { useAppStore } from '@/lib/store';
import type { PersistedState } from '@/lib/types';

import styles from './backup-section.module.css';

/** 日付を含むエクスポートファイル名を組み立てる。YYYY-MM-DD 形式。 */
function exportFileName(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `advanced-new-tab-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

function summarize(state: PersistedState, t: (text: string, vars?: TranslateVars) => string): string {
  return t('ウィジェット {count} 個', { count: Object.keys(state.widgets).length });
}

/**
 * 設定のバックアップ（JSONのエクスポート/インポート）。
 * 以前はオプションページにしか無く、それ以外の設定はすべて新しいタブのサイドパネルにあるため
 * 「設定はどこ？」と迷う原因になっていた。サイドパネルの「見た目」に置き、オプションページも
 * この同じ部品を表示するだけにしている。ファイルの読み書きしか使わないので Web 版でも動く。
 */
export function BackupSection() {
  const t = useT();
  const state = useAppStore((s) => s.state);
  const replaceState = useAppStore((s) => s.replaceState);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<PersistedState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const handleExport = (): void => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName();
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelected = (file: File): void => {
    setImportError(null);
    setApplied(false);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown;
        setPendingImport(parseImportedState(parsed));
      } catch (error) {
        setImportError(
          error instanceof Error
            ? t('ファイルを読み込めませんでした: {message}', { message: error.message })
            : t('ファイルを読み込めませんでした。'),
        );
      }
    };
    reader.readAsText(file);
  };

  const applyImport = (): void => {
    if (!pendingImport) return;
    replaceState(pendingImport);
    setPendingImport(null);
    setApplied(true);
  };

  return (
    <div className={styles.root}>
      <p className={styles.desc}>
        {t('現在の配置・ウィジェット設定・見た目をひとつのJSONファイルに書き出します。端末の乗り換えや、設定の共有・バックアップに使えます。')}
      </p>
      <div className={styles.row}>
        <button type="button" className={styles.button} onClick={handleExport}>
          <Download size={14} />
          {t('JSONをダウンロード')}
        </button>
        <button type="button" className={styles.button} onClick={() => fileInputRef.current?.click()}>
          <FolderOpen size={14} />
          {t('ファイルを選択')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelected(file);
            e.target.value = '';
          }}
        />
      </div>
      <div className={styles.note}>{t('現在の設定: {summary}', { summary: summarize(state, t) })}</div>

      {importError && (
        <div className={styles.error}>
          <CircleAlert size={14} />
          {importError}
        </div>
      )}

      {pendingImport && (
        <div className={styles.pending}>
          <div>{t('読み込み内容: {summary}', { summary: summarize(pendingImport, t) })}</div>
          <div className={styles.note}>
            {t('エクスポートしたJSONファイルを読み込みます。適用すると、現在の配置・設定はすべて置き換わります。')}
          </div>
          <div className={styles.row}>
            <button type="button" className={styles.buttonPrimary} onClick={applyImport}>
              {t('この内容を適用する（現在の設定を上書き）')}
            </button>
            <button type="button" className={styles.button} onClick={() => setPendingImport(null)}>
              {t('キャンセル')}
            </button>
          </div>
        </div>
      )}

      {applied && (
        <div className={styles.success}>
          <CircleCheck size={14} />
          {t('設定を適用しました。')}
        </div>
      )}
    </div>
  );
}
