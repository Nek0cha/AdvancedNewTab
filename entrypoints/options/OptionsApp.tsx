import { useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Download, FileUp, FolderOpen } from 'lucide-react';

import { useT, type TranslateVars } from '@/lib/i18n';
import { parseImportedState } from '@/lib/storage';
import { useAppStore } from '@/lib/store';
import type { PersistedState } from '@/lib/types';

import styles from './options.module.css';

/** 日付を含むエクスポートファイル名を組み立てる。YYYY-MM-DD 形式。 */
function exportFileName(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `advanced-new-tab-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

function summarize(state: PersistedState, t: (text: string, vars?: TranslateVars) => string): string {
  const widgetCount = Object.keys(state.widgets).length;
  return t('ウィジェット {count} 個', { count: widgetCount });
}

export function OptionsApp() {
  const t = useT();
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);
  const state = useAppStore((s) => s.state);
  const replaceState = useAppStore((s) => s.replaceState);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<PersistedState | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  if (!ready) return null;

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
    <main className={styles.page}>
      <h1 className={styles.title}>{t('AdvancedNewTab の設定')}</h1>
      <p className={styles.lead}>
        {t('ウィジェットの追加・配置・見た目の設定は、新しいタブページ上で直接行えます。このページでは設定のバックアップと復元を扱います。')}
      </p>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <Download size={16} />
          {t('エクスポート')}
        </h2>
        <p className={styles.sectionDesc}>
          {t('現在の配置・ウィジェット設定・見た目をひとつのJSONファイルに書き出します。端末の乗り換えや、設定の共有・バックアップに使えます。')}
        </p>
        <div className={styles.row}>
          <button type="button" className={styles.button} onClick={handleExport}>
            <Download size={15} />
            {t('JSONをダウンロード')}
          </button>
        </div>
        <div className={styles.summary}>{t('現在の設定: {summary}', { summary: summarize(state, t) })}</div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <FileUp size={16} />
          {t('インポート')}
        </h2>
        <p className={styles.sectionDesc}>
          {t('エクスポートしたJSONファイルを読み込みます。適用すると、現在の配置・設定はすべて置き換わります。')}
        </p>
        <div className={styles.row}>
          <button
            type="button"
            className={styles.button}
            onClick={() => fileInputRef.current?.click()}
          >
            <FolderOpen size={15} />
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

        {importError && (
          <div className={styles.error}>
            <CircleAlert size={14} />
            {importError}
          </div>
        )}

        {pendingImport && (
          <div className={styles.summary}>
            {t('読み込み内容: {summary}', { summary: summarize(pendingImport, t) })}
            <div className={styles.row} style={{ marginTop: 10 }}>
              <button type="button" className={styles.buttonPrimary} onClick={applyImport}>
                {t('この内容を適用する（現在の設定を上書き）')}
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => setPendingImport(null)}
              >
                {t('キャンセル')}
              </button>
            </div>
          </div>
        )}

        {applied && (
          <div className={styles.success}>
            <CircleCheck size={14} />
            {t('設定を適用しました。新しいタブを開いて確認してください。')}
          </div>
        )}
      </section>
    </main>
  );
}
