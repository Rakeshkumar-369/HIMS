import { Toaster } from 'sonner';
import { useMode } from '../lib/hooks';

export default function ThemedToaster() {
  const { mode } = useMode();
  return <Toaster theme={mode} position="top-center" richColors closeButton toastOptions={{ style: { borderRadius: 18, fontFamily: 'inherit' } }} />;
}
