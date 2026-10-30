import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Đăng ký Service Worker cho PWA Offline-First
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[HOME MONI PWA] Service Worker đăng ký thành công:', reg.scope);
      })
      .catch((err) => {
        console.warn('[HOME MONI PWA] Đăng ký Service Worker thất bại:', err);
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
