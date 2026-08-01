import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { haptic } = useTelegram();

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = Math.random().toString(36).substring(2, 9);
      if (type === 'success') haptic('medium');
      else if (type === 'error') haptic('heavy');
      else haptic('light');

      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);

      setTimeout(() => {
        removeToast(id);
      }, 3200);
    },
    [haptic, removeToast],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={styles.toastContainer}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} style={styles.toast}>
            <div style={styles.iconWrapper}>
              {toast.type === 'success' && <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />}
              {toast.type === 'error' && <XCircle size={18} style={{ color: 'var(--danger)' }} />}
              {toast.type === 'warning' && <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />}
              {toast.type === 'info' && <Info size={18} style={{ color: 'var(--info)' }} />}
            </div>
            <span style={styles.message}>{toast.message}</span>
            <button
              style={styles.closeBtn}
              onClick={() => removeToast(toast.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const styles: Record<string, React.CSSProperties> = {
  toastContainer: {
    position: 'fixed',
    top: 'calc(12px + env(safe-area-inset-top, 0px))',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: 'calc(100% - 32px)',
    maxWidth: 440,
    pointerEvents: 'none',
  },
  toast: {
    pointerEvents: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderRadius: '14px',
    background: 'rgba(18, 20, 38, 0.94)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid var(--glass-border)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(147, 51, 234, 0.15)',
    animation: 'toastEnter 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    color: 'var(--text-primary)',
    fontSize: 13.5,
    fontWeight: 600,
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  message: {
    flex: 1,
    lineHeight: 1.4,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
