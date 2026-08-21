"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles: Record<ToastType, string> = {
  success: "border-green-200 bg-white text-zinc-900",
  error: "border-[#c8102e] bg-[#fdeeef] text-[#8a0a1e]",
  info: "border-zinc-200 bg-white text-zinc-900",
};

const icon: Record<ToastType, string> = {
  success: "check",
  error: "!",
  info: "i",
};

const iconColor: Record<ToastType, string> = {
  success: "bg-green-600 text-white",
  error: "bg-[#c8102e] text-white",
  info: "bg-zinc-600 text-white",
};

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "success") {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth={3.5} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return <>{icon[type]}</>;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3 shadow-lg shadow-zinc-900/10 toast-in ${styles[t.type]}`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${iconColor[t.type]}`}
            >
              <ToastIcon type={t.type} />
            </span>
            <p className="text-sm leading-snug">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
              className="ml-auto shrink-0 text-zinc-400 transition-colors hover:text-zinc-700"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
