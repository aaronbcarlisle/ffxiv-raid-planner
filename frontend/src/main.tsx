import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './index.css';
import App from './App.tsx';
import { ThemeProvider } from './hooks/useTheme';

// FOUC prevention is handled by the inline <script> in index.html which runs
// before any CSS loads. Keep that script's logic in sync with getInitialTheme()
// in hooks/useTheme.ts.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
      <Analytics />
      <SpeedInsights />
    </BrowserRouter>
  </StrictMode>
);
