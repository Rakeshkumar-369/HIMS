import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { applyTheme } from './lib/themes';
import ThemedToaster from './components/ThemedToaster';
import { registerServiceWorker } from './lib/pwa';

registerServiceWorker();
applyTheme('mint'); // sets light/dark before first paint; the clinic theme replaces it after login

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <ThemedToaster />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
