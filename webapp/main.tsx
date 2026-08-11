import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import 'react-grid-layout/css/styles.css';
import '@/entrypoints/newtab/style.css';

import { App } from '@/entrypoints/newtab/App';

import { MobileGate } from './MobileGate';

// 拡張機能版（entrypoints/newtab/main.tsx）と全く同じ土台を、独立したVite静的ビルド
// （vite.web.config.ts、`npm run build:web`）から使う入口。App自体はchrome/browser APIに
// 直接触れておらず、lib/storage.ts・lib/favicon.ts・lib/permissions.ts が
// isExtensionContext()（lib/platform.ts）で自動的に静的サイト向けの実装へ切り替わるため、
// このファイルはエントリポイントを用意するだけでよい。
//
// entrypoints/ 配下ではなくプロジェクト直下の webapp/ に置いているのは、WXTが
// entrypoints/ 配下のディレクトリを自動的に拡張機能の1ページとして検出・同梱してしまう
// （＝拡張機能ビルドとは無関係にしたいこのページが .output/chrome-mv3 に紛れ込む）のを
// 避けるため。

const container = document.getElementById('root');
if (!container) throw new Error('#root が見つかりません');

createRoot(container).render(
  <StrictMode>
    <MobileGate>
      <App />
    </MobileGate>
  </StrictMode>,
);
