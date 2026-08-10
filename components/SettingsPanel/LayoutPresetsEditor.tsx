import { useState } from 'react';
import { Download, Save, Trash2 } from 'lucide-react';

import { cx } from '@/lib/cx';
import { useAppStore } from '@/lib/store';
import { MAX_LAYOUT_PRESETS } from '@/lib/types';

import styles from './layout-presets-editor.module.css';

function formatSavedAt(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * 誤操作で今のレイアウトを失わないよう、危険な操作（読み込み・削除）は
 * 「もう一度押すと確定」の2段階にしている。3秒操作が無ければ自動的に解除する。
 */
function useArmedAction(): [number | null, (slot: number) => boolean] {
  const [armedSlot, setArmedSlot] = useState<number | null>(null);

  const trigger = (slot: number): boolean => {
    if (armedSlot === slot) {
      setArmedSlot(null);
      return true;
    }
    setArmedSlot(slot);
    setTimeout(() => setArmedSlot((current) => (current === slot ? null : current)), 3000);
    return false;
  };

  return [armedSlot, trigger];
}

/** 見た目パネルの「レイアウト保存」セクション。最大 MAX_LAYOUT_PRESETS 枠。 */
export function LayoutPresetsEditor() {
  const layoutPresets = useAppStore((s) => s.state.layoutPresets);
  const saveLayoutPreset = useAppStore((s) => s.saveLayoutPreset);
  const loadLayoutPreset = useAppStore((s) => s.loadLayoutPreset);
  const deleteLayoutPreset = useAppStore((s) => s.deleteLayoutPreset);

  const [nameDrafts, setNameDrafts] = useState<Record<number, string>>({});
  const [armedLoad, triggerLoad] = useArmedAction();
  const [armedDelete, triggerDelete] = useArmedAction();

  return (
    <div className={styles.root}>
      <p className={styles.help}>
        今のウィジェット配置・構成を最大{MAX_LAYOUT_PRESETS}枠まで保存し、後から呼び出せます
        （見た目のテーマは含まれません）。読み込むと今の配置は上書きされます。
      </p>
      {Array.from({ length: MAX_LAYOUT_PRESETS }, (_, slot) => {
        const preset = layoutPresets[slot] ?? null;
        const draft = nameDrafts[slot] ?? preset?.name ?? `レイアウト${slot + 1}`;

        return (
          <div key={slot} className={styles.slot}>
            <input
              type="text"
              className={styles.nameInput}
              value={draft}
              onChange={(e) => setNameDrafts((prev) => ({ ...prev, [slot]: e.target.value }))}
              placeholder={`レイアウト${slot + 1}`}
            />
            <div className={styles.slotMeta}>
              {preset ? `保存日時: ${formatSavedAt(preset.savedAt)}` : '未保存'}
            </div>
            <div className={styles.slotActions}>
              <button
                type="button"
                className={styles.actionButton}
                title="今の配置をこの枠に保存"
                onClick={() => saveLayoutPreset(slot, draft.trim() || `レイアウト${slot + 1}`)}
              >
                <Save size={14} />
                保存
              </button>
              <button
                type="button"
                className={cx(styles.actionButton, !preset && styles.disabled, armedLoad === slot && styles.armed)}
                disabled={!preset}
                title="この枠の内容を読み込む（今の配置は上書きされます）"
                onClick={() => {
                  if (triggerLoad(slot)) loadLayoutPreset(slot);
                }}
              >
                <Download size={14} />
                {armedLoad === slot ? 'もう一度で読込' : '読込'}
              </button>
              <button
                type="button"
                className={cx(
                  styles.actionButton,
                  styles.danger,
                  !preset && styles.disabled,
                  armedDelete === slot && styles.armed,
                )}
                disabled={!preset}
                title="この枠を空にする"
                onClick={() => {
                  if (triggerDelete(slot)) deleteLayoutPreset(slot);
                }}
              >
                <Trash2 size={14} />
                {armedDelete === slot ? 'もう一度で削除' : '削除'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
