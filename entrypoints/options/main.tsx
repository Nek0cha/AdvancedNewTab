import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '../newtab/style.css';
import { OptionsApp } from './OptionsApp';

const container = document.getElementById('root');
if (!container) throw new Error('#root が見つかりません');

createRoot(container).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
);
