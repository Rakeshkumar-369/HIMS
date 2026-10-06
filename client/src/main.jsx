import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { applyTheme } from './lib/themes';
import { useMode } from './lib/hooks';

applyTheme('mint'); // sets light/dark before first paint; the clinic theme replaces it after login

function ThemedToaster() {
  const { mode } = useMode();
  return <Toaster theme={mode} position="top-center" richColors closeButton toastOptions={{ style: { borderRadius: 18, fontFamily: 'inherit' } }} />;
}

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
