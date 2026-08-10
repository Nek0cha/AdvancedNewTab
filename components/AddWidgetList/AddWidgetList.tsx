import { useState } from 'react';

import { requestWidgetPermissions } from '@/lib/permissions';
import { useAppStore } from '@/lib/store';
import { listWidgetDefs } from '@/widgets/registry';
import type { AnyWidgetDef } from '@/widgets/types';

import styles from './add-widget-list.module.css';

/** 追加ダイアログに出す「必要な権限」の説明文。 */
function permissionNote(def: AnyWidgetDef): string | null {
  const chrome = def.permissions?.chrome ?? [];
  const hosts = def.permissions?.hosts ?? [];
  if (chrome.length === 0 && hosts.length === 0) return null;

  const parts: string[] = [];
  if (chrome.length > 0) parts.push(`ブラウザの ${chrome.join(' / ')} へのアクセス`);
  if (hosts.length > 0) parts.push('外部サイトへの通信');
  return `追加時に ${parts.join(' と ')} の許可を求めます`;
}

/**
 * 追加できるウィジェットの一覧。レジストリの登録内容をそのまま並べている。
 * ウィジェットを1つ足せばこの一覧にも自動で現れるため、ここを編集する必要はない。
 */
export function AddWidgetList() {
  const addWidget = useAppStore((s) => s.addWidget);
  const openPanel = useAppStore((s) => s.openPanel);
  /** 直前に権限を拒否したウィジェットの type。ボタン付近に説明を出すために覚えておく */
  const [deniedType, setDeniedType] = useState<string | null>(null);

  const finishAdd = (def: AnyWidgetDef): void => {
    const instanceId = addWidget({
      type: def.type,
      defaultSettings: def.defaultSettings,
      defaultLayout: def.defaultLayout,
    });
    // 追加したらそのまま設定を触れる流れにする
    if (def.settingsSchema.length > 0) {
      openPanel({ kind: 'widget', instanceId });
    }
  };

  const handleAdd = (def: AnyWidgetDef): void => {
    setDeniedType(null);
    const needsPermission = (def.permissions?.chrome?.length ?? 0) > 0 ||
      (def.permissions?.hosts?.length ?? 0) > 0;

    if (!needsPermission) {
      finishAdd(def);
      return;
    }

    // chrome.permissions.request はユーザージェスチャーの呼び出しスタック内でしか
    // 動かないため、このクリックハンドラから同期的に呼ぶ（await の前に発火させる）。
    void requestWidgetPermissions(def).then((granted) => {
      if (granted) {
        finishAdd(def);
      } else {
        setDeniedType(def.type);
      }
    });
  };

  return (
    <div className={styles.list}>
      {listWidgetDefs().map((def) => {
        const note = permissionNote(def);
        return (
          <button
            key={def.type}
            type="button"
            className={styles.item}
            onClick={() => handleAdd(def)}
          >
            <span className={styles.iconWrap}>
              <def.icon size={18} />
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{def.name}</span>
              <span className={styles.description}>{def.description}</span>
              {note && <span className={styles.permission}>{note}</span>}
              {deniedType === def.type && (
                <span className={styles.permission} style={{ color: '#e07a7a' }}>
                  権限が許可されなかったため追加できませんでした。もう一度お試しください。
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
