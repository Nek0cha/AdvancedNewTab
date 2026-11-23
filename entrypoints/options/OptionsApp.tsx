import { useEffect } from 'react';

import { BackupSection } from '@/components/SettingsPanel/BackupSection';
import { useT } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';

import styles from './options.module.css';

/**
 * 拡張機能の「オプション」ページ。ツールバーのアイコンから開かれる。
 * 設定はすべて新しいタブのサイドパネルに集約したため、ここはバックアップ部品を
 * そのまま表示するだけの入口にしている（ストアのオプション導線を残すため、ページ自体は消さない）。
 */
export function OptionsApp() {
  const t = useT();
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (!ready) return null;

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t('AdvancedNewTab の設定')}</h1>
      <p className={styles.lead}>
        {t('ウィジェットの追加・配置・見た目・バックアップの設定は、新しいタブページの「編集」→「見た目」からまとめて行えます。')}
      </p>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('バックアップ')}</h2>
        <BackupSection />
      </section>
    </main>
  );
}
