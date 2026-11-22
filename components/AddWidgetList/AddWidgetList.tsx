import { useState } from 'react';

import { Search } from 'lucide-react';

import { useT, type TranslateVars } from '@/lib/i18n';
import { isExtensionContext } from '@/lib/platform';
import { requestWidgetPermissions } from '@/lib/permissions';
import { useAppStore } from '@/lib/store';
import { listWidgetDefs } from '@/widgets/registry';
import { WIDGET_CATEGORIES, type AnyWidgetDef } from '@/widgets/types';

import styles from './add-widget-list.module.css';

/**
 * 追加ダイアログに出す「必要な権限」の説明文。
 * 静的サイト版（拡張機能コンテキスト以外）には権限という概念自体が無く、
 * lib/permissions.ts のガードにより許可ダイアログも実際には出ないため、
 * 誤解を招かないよう表示自体を省く。
 */
function permissionNote(def: AnyWidgetDef, t: (text: string, vars?: TranslateVars) => string): string | null {
  if (!isExtensionContext()) return null;
  const chrome = def.permissions?.chrome ?? [];
  const hosts = def.permissions?.hosts ?? [];
  if (chrome.length === 0 && hosts.length === 0) return null;

  const parts: string[] = [];
  if (chrome.length > 0) parts.push(t('ブラウザの {chrome} へのアクセス', { chrome: chrome.join(' / ') }));
  if (hosts.length > 0) parts.push(t('外部サイトへの通信'));
  return t('追加時に {parts} の許可を求めます', { parts: parts.join(t(' と ')) });
}

/**
 * 追加できるウィジェットの一覧。レジストリの登録内容をそのまま並べている。
 * ウィジェットを1つ足せばこの一覧にも自動で現れるため、ここを編集する必要はない。
 */
export function AddWidgetList() {
  const t = useT();
  const addWidget = useAppStore((s) => s.addWidget);
  const openPanel = useAppStore((s) => s.openPanel);
  /** 直前に権限を拒否したウィジェットの type。ボタン付近に説明を出すために覚えておく */
  const [deniedType, setDeniedType] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  const renderItem = (def: AnyWidgetDef) => {
    const note = permissionNote(def, t);
    return (
      <button key={def.type} type="button" className={styles.item} onClick={() => handleAdd(def)}>
        <span className={styles.iconWrap}>
          <def.icon size={18} />
        </span>
        <span className={styles.text}>
          <span className={styles.name}>{t(def.name)}</span>
          <span className={styles.description}>{t(def.description)}</span>
          {note && <span className={styles.permission}>{note}</span>}
          {deniedType === def.type && (
            <span className={styles.permission} style={{ color: '#e07a7a' }}>
              {t('権限が許可されなかったため追加できませんでした。もう一度お試しください。')}
            </span>
          )}
        </span>
      </button>
    );
  };

  const query = search.trim().toLowerCase();
  // 訳文と日本語の原文の両方を検索対象にする。表示言語を切り替えていても、
  // 覚えている方の名前で引けるようにするため。
  const matches = (def: AnyWidgetDef): boolean =>
    query === '' ||
    [def.name, def.description, t(def.name), t(def.description)].some((s) => s.toLowerCase().includes(query));
  const groups = WIDGET_CATEGORIES.map((c) => ({
    ...c,
    defs: listWidgetDefs().filter((d) => d.category === c.id && matches(d)),
  })).filter((g) => g.defs.length > 0);

  return (
    <div className={styles.list}>
      <label className={styles.search}>
        <Search size={14} aria-hidden />
        <input
          type="search"
          value={search}
          autoFocus
          placeholder={t('ウィジェットを検索')}
          aria-label={t('ウィジェットを検索')}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {groups.length === 0 && <p className={styles.empty}>{t('該当するウィジェットはありません')}</p>}
      {groups.map((group) => (
        <section key={group.id} className={styles.group}>
          <h4 className={styles.groupTitle}>{t(group.label)}</h4>
          {group.defs.map((def) => renderItem(def))}
        </section>
      ))}
    </div>
  );
}
