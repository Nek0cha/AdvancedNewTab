import { useEffect } from 'react';

import { AddWidgetList } from '@/components/AddWidgetList/AddWidgetList';
import { Grid } from '@/components/Grid/Grid';
import { SidePanel } from '@/components/SidePanel/SidePanel';
import { ThemeSettingsPanel } from '@/components/SettingsPanel/ThemeSettingsPanel';
import { WidgetSettingsPanel } from '@/components/SettingsPanel/WidgetSettingsPanel';
import { Toolbar } from '@/components/Toolbar/Toolbar';
import { useAppStore } from '@/lib/store';
import { imageOverlayStyle } from '@/lib/theme';

/** 開いているパネルに対応する見出しと中身。 */
function PanelContent() {
  const panel = useAppStore((s) => s.panel);
  const closePanel = useAppStore((s) => s.closePanel);

  if (!panel) return null;

  switch (panel.kind) {
    case 'add':
      return (
        <SidePanel title="ウィジェットを追加" onClose={closePanel}>
          <AddWidgetList />
        </SidePanel>
      );
    case 'widget':
      return (
        <SidePanel title="ウィジェットの設定" onClose={closePanel}>
          <WidgetSettingsPanel instanceId={panel.instanceId} />
        </SidePanel>
      );
    case 'theme':
      return (
        <SidePanel title="見た目の設定" onClose={closePanel}>
          <ThemeSettingsPanel />
        </SidePanel>
      );
  }
}

export function App() {
  const ready = useAppStore((s) => s.ready);
  const init = useAppStore((s) => s.init);
  const background = useAppStore((s) => s.state.theme.background);
  const editMode = useAppStore((s) => s.editMode);
  const setEditMode = useAppStore((s) => s.setEditMode);

  useEffect(() => {
    void init();
  }, [init]);

  // Escape で編集モードを抜けられるようにする（パネルが開いている場合はパネル側が先に処理する）
  useEffect(() => {
    if (!editMode) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setEditMode(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editMode, setEditMode]);

  // storage の読み込みが終わるまでは何も描かない。
  // 背景は boot.js が既に塗っているため、ここが空でも白い画面にはならない。
  if (!ready) return null;

  const overlay = imageOverlayStyle(background);

  return (
    <>
      {background.active === 'image' && background.image.src && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            backgroundImage: `url("${background.image.src}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      {overlay && (
        <div
          aria-hidden
          style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', ...overlay }}
        />
      )}

      <Grid />
      <Toolbar />
      <PanelContent />
    </>
  );
}
