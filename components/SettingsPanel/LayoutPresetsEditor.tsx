import { useEffect, useState } from 'react';
import { Download, Plus, Save, Trash2 } from 'lucide-react';

import { useT } from '@/lib/i18n';
import { cx } from '@/lib/cx';
import { useAppStore } from '@/lib/store';
import type { LayoutPreset } from '@/lib/types';

import styles from './layout-presets-editor.module.css';

function formatSavedAt(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 誤操作で今のレイアウトや保存済みの内容を失わないよう、危険な操作（上書き・読み込み・削除）は
 * 「もう一度押すと確定」の2段階にしている。3秒操作が無ければ自動的に解除する。
 * 確定待ちの対象は「操作の種類 + 項目の id」の組で覚え、別の項目・別のボタンを押したら
 * そちらに切り替わる（2つ同時に確定待ちにはならない）。
 */
function useArmedAction(): [string | null, (key: string) => boolean] {
  const [armedKey, setArmedKey] = useState<string | null>(null);

  const trigger = (key: string): boolean => {
    if (armedKey === key) {
      setArmedKey(null);
      return true;
    }
    setArmedKey(key);
    setTimeout(() => setArmedKey((current) => (current === key ? null : current)), 3000);
    return false;
  };

  return [armedKey, trigger];
}

/**
 * 保存済みの1件。名前の入力欄は、1文字ごとに保存すると Undo の履歴が1文字ずつ積まれてしまうため、
 * 手元の下書きとして持ち、フォーカスが外れたときか Enter を押したときにだけ確定する。
 */
function PresetRow({
  preset,
  armedKey,
  trigger,
}: {
  preset: LayoutPreset;
  armedKey: string | null;
  trigger: (key: string) => boolean;
}) {
  const t = useT();
  const overwriteLayoutPreset = useAppStore((s) => s.overwriteLayoutPreset);
  const renameLayoutPreset = useAppStore((s) => s.renameLayoutPreset);
  const loadLayoutPreset = useAppStore((s) => s.loadLayoutPreset);
  const deleteLayoutPreset = useAppStore((s) => s.deleteLayoutPreset);

  const [draft, setDraft] = useState(preset.name);
  // Undo や別タブでの変更で名前が外から変わったときは、入力欄も追従させる
  useEffect(() => setDraft(preset.name), [preset.name]);

  const commitName = () => {
    const name = draft.trim();
    if (name) renameLayoutPreset(preset.id, name);
    else setDraft(preset.name);
  };

  const overwriteKey = `overwrite:${preset.id}`;
  const loadKey = `load:${preset.id}`;
  const deleteKey = `delete:${preset.id}`;

  return (
    <div className={styles.slot}>
      <input
        type="text"
        className={styles.nameInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        aria-label={t('レイアウトの名前')}
      />
      <div className={styles.slotMeta}>{t('保存日時: {date}', { date: formatSavedAt(preset.savedAt) })}</div>
      <div className={styles.slotActions}>
        <button
          type="button"
          className={cx(styles.actionButton, armedKey === overwriteKey && styles.armed)}
          title={t('今の配置でこのレイアウトを上書きする')}
          onClick={() => {
            if (trigger(overwriteKey)) overwriteLayoutPreset(preset.id);
          }}
        >
          <Save size={14} />
          {armedKey === overwriteKey ? t('もう一度で上書き') : t('上書き')}
        </button>
        <button
          type="button"
          className={cx(styles.actionButton, armedKey === loadKey && styles.armed)}
          title={t('このレイアウトを読み込む（今の配置は上書きされます）')}
          onClick={() => {
            if (trigger(loadKey)) loadLayoutPreset(preset.id);
          }}
        >
          <Download size={14} />
          {armedKey === loadKey ? t('もう一度で読込') : t('読込')}
        </button>
        <button
          type="button"
          className={cx(styles.actionButton, styles.danger, armedKey === deleteKey && styles.armed)}
          title={t('このレイアウトを削除する')}
          onClick={() => {
            if (trigger(deleteKey)) deleteLayoutPreset(preset.id);
          }}
        >
          <Trash2 size={14} />
          {armedKey === deleteKey ? t('もう一度で削除') : t('削除')}
        </button>
      </div>
    </div>
  );
}

/** 見た目パネルの「レイアウト保存」セクション。件数の上限は無い。 */
export function LayoutPresetsEditor() {
  const t = useT();
  const layoutPresets = useAppStore((s) => s.state.layoutPresets);
  const saveLayoutPreset = useAppStore((s) => s.saveLayoutPreset);

  const [newName, setNewName] = useState('');
  const [armedKey, trigger] = useArmedAction();

  const defaultName = t('レイアウト{n}', { n: layoutPresets.length + 1 });
  const saveNew = () => {
    saveLayoutPreset(newName.trim() || defaultName);
    setNewName('');
  };

  return (
    <div className={styles.root}>
      <p className={styles.help}>
        {t('今のウィジェット配置・構成・見た目のテーマをまとめて名前を付けて保存し、後から呼び出せます。読み込むと今の配置・テーマは上書きされます。')}
      </p>
      <div className={styles.newRow}>
        <input
          type="text"
          className={styles.nameInput}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveNew();
          }}
          placeholder={defaultName}
          aria-label={t('新しいレイアウトの名前')}
        />
        <button type="button" className={styles.actionButton} onClick={saveNew}>
          <Plus size={14} />
          {t('今の配置を保存')}
        </button>
      </div>
      {layoutPresets.length === 0 ? (
        <div className={styles.slotMeta}>{t('保存したレイアウトはまだありません。')}</div>
      ) : (
        // 新しく保存したものを上に出す（保存直後に、押したボタンのすぐ下で結果が見えるように）
        [...layoutPresets]
          .reverse()
          .map((preset) => <PresetRow key={preset.id} preset={preset} armedKey={armedKey} trigger={trigger} />)
      )}
    </div>
  );
}
