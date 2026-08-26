import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { readTheme, applyTheme } from './lib/theme';
import './styles.css';

// Apply the saved theme before first paint so there is no light/dark flash.
applyTheme(readTheme());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
