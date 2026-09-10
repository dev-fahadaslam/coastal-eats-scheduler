import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type ToastKind = 'info' | 'success' | 'warning';
interface ToastState { message: string; kind: ToastKind; visible: boolean }

const ToastContext = createContext<((message: string, kind?: ToastKind) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>({ message: '', kind: 'info', visible: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
    setToast({ message, kind, visible: true });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 4200);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div id="toast" className={toast.visible ? 'show' : ''} data-kind={toast.kind}>{toast.message}</div>
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string, kind?: ToastKind) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
