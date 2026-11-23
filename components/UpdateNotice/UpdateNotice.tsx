import { useEffect, useState } from 'react';
import { ArrowUpRight, Sparkles, X } from 'lucide-react';

import { useT } from '@/lib/i18n';
import { isExtensionContext } from '@/lib/platform';
import { UPDATE_NOTICE_KEY, changelogUrl, parseUpdateNotice, type UpdateNotice as Notice } from '@/lib/update-notice';

import styles from './update-notice.module.css';

/**
 * アップデート後に画面下に出す「更新されました」のお知らせ（lib/update-notice.ts 参照）。
 * 閉じるか「変更内容を見る」を押すまで、新しいタブを開くたびに出し続ける。
 */
export function UpdateNotice() {
  const t = useT();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    // 静的サイト版（site/app）にはアップデートという概念が無い
    if (!isExtensionContext()) return;
    let cancelled = false;
    void browser.storage.local.get(UPDATE_NOTICE_KEY).then((stored) => {
      if (!cancelled) setNotice(parseUpdateNotice(stored[UPDATE_NOTICE_KEY]));
    });
    // 他のタブで閉じたら、開いている全部のタブから消す
    const onChanged = (changes: Record<string, Browser.storage.StorageChange>, area: string): void => {
      if (area !== 'local' || !(UPDATE_NOTICE_KEY in changes)) return;
      setNotice(parseUpdateNotice(changes[UPDATE_NOTICE_KEY]?.newValue));
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      browser.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  if (!notice) return null;

  const dismiss = (): void => {
    setNotice(null);
    void browser.storage.local.remove(UPDATE_NOTICE_KEY);
  };

  return (
    <div className={styles.root} role="status">
      <Sparkles size={16} className={styles.icon} aria-hidden />
      <span className={styles.message}>
        {t('AdvancedNewTab が v{version} にアップデートされました。', { version: notice.version })}
      </span>
      <a
        className={styles.link}
        href={changelogUrl(notice.version)}
        target="_blank"
        rel="noopener noreferrer"
        // 変更内容を見に行ったなら、お知らせの役目は果たしたので閉じる
        onClick={dismiss}
      >
        {t('変更内容を見る')}
        <ArrowUpRight size={14} aria-hidden />
      </a>
      <button type="button" className={styles.close} title={t('閉じる')} aria-label={t('閉じる')} onClick={dismiss}>
        <X size={14} />
      </button>
    </div>
  );
}
