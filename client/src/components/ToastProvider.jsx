import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export default function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const notify = useCallback((message, type = 'success') => setToast({ message, type, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return <ToastContext.Provider value={notify}>{children}<div className="toast-region" aria-live="polite" aria-atomic="true">{toast && <div className={`toast-message toast-${toast.type}`} role="status">{toast.type === 'error' ? <XCircle size={17} /> : <CheckCircle2 size={17} />}<span>{toast.message}</span><button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification"><X size={15} /></button></div>}</div></ToastContext.Provider>;
}
