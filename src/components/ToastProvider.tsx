import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [{ ...toast, id }, ...prev].slice(0, 4));
      window.setTimeout(() => {
        dismiss(id);
      }, 3600);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Umpan balik aktivitas"
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 sm:px-0"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const borderClass =
              toast.variant === 'success'
                ? 'border-emerald-700/70 bg-[#0A1B1E]/95'
                : toast.variant === 'error'
                  ? 'border-red-700/70 bg-[#1B0D14]/95'
                  : toast.variant === 'warning'
                    ? 'border-amber-700/70 bg-[#1A160B]/95'
                    : 'border-[#2B436E] bg-[#0B1428]/95';

            const Icon =
              toast.variant === 'success'
                ? CheckCircle2
                : toast.variant === 'error' || toast.variant === 'warning'
                  ? AlertCircle
                  : Info;

            const iconColor =
              toast.variant === 'success'
                ? 'text-emerald-400'
                : toast.variant === 'error'
                  ? 'text-red-400'
                  : toast.variant === 'warning'
                    ? 'text-amber-400'
                    : 'text-sky-400';

            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className={`pointer-events-auto rounded-xl border backdrop-blur-md p-3.5 shadow-lg flex items-start gap-3 ${borderClass}`}
              >
                <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white">{toast.title}</div>
                  {toast.description && (
                    <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                      {toast.description}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Tutup pemberitahuan"
                  className="p-1 rounded text-slate-400 hover:text-white transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return { showToast: () => {} };
  }
  return ctx;
}
