import type { ReactNode, ButtonHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { DAYS, type Day } from "@/lib/days";

export const BRAND = {
  red: "bg-[#c8102e] text-white hover:bg-[#a50d26]",
  tint: "bg-[#fdeeef] text-[#a50d26]",
  chip: "bg-[#fdeeef] text-[#c8102e]",
  border: "border-[#f3c8cf]",
};

export function Card({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#c8102e]">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-500" role="status" aria-live="polite">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-[#c8102e]" />
      {label && <span>{label}</span>}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[#c8102e] text-white shadow-sm hover:bg-[#a50d26] hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.99]",
  danger: "bg-[#8a0a1e] text-white hover:bg-[#6d0818] active:scale-[0.99]",
  ghost: "text-[#c8102e] hover:bg-[#fdeeef]",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${buttonStyles[variant]} ${className}`}
      {...props}
    />
  );
}

export function DayPicker({
  value,
  onChange,
}: {
  value: Day[];
  onChange: (days: Day[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DAYS.map((day) => {
        const active = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((d) => d !== day) : [...value, day])}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              active
                ? "bg-[#c8102e] text-white"
                : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {day}
          </button>
        );
      })}
    </div>
  );
}

export function DayBadges({ days }: { days: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {days.map((d) => (
        <span
          key={d}
          className="rounded-md bg-[#fdeeef] px-1.5 py-0.5 text-xs font-semibold text-[#c8102e]"
        >
          {d}
        </span>
      ))}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="whitespace-pre-line rounded-lg border border-[#f3c8cf] bg-[#fdeeef] px-3 py-2 text-sm text-[#8a0a1e]">
      {message}
    </div>
  );
}

export function NoticeBanner({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-lg border border-[#f3c8cf] bg-[#fdeeef] px-3 py-2 text-sm text-[#8a0a1e]">
      {message}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-[#c8102e]" : "bg-zinc-300"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const openDialogs: symbol[] = [];
let lastPointerTarget: HTMLElement | null = null;
let bodyLock: {
  scrollY: number;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyWidth: string;
  documentOverflow: string;
} | null = null;

function lockPageScroll() {
  if (bodyLock || typeof document === "undefined") return;
  const body = document.body;
  bodyLock = {
    scrollY: window.scrollY,
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyWidth: body.style.width,
    documentOverflow: document.documentElement.style.overflow,
  };
  document.documentElement.style.overflow = "hidden";
  body.style.overflow = "hidden";
  body.style.position = "fixed";
  body.style.top = `-${bodyLock.scrollY}px`;
  body.style.width = "100%";
}

function unlockPageScroll() {
  if (!bodyLock || typeof document === "undefined") return;
  const previous = bodyLock;
  bodyLock = null;
  const body = document.body;
  document.documentElement.style.overflow = previous.documentOverflow;
  body.style.overflow = previous.bodyOverflow;
  body.style.position = previous.bodyPosition;
  body.style.top = previous.bodyTop;
  body.style.width = previous.bodyWidth;
  window.scrollTo(0, previous.scrollY);
}

function registerDialog(id: symbol) {
  const wasEmpty = openDialogs.length === 0;
  openDialogs.push(id);
  if (wasEmpty) lockPageScroll();
}

function unregisterDialog(id: symbol) {
  const index = openDialogs.lastIndexOf(id);
  if (index >= 0) openDialogs.splice(index, 1);
  if (openDialogs.length === 0) unlockPageScroll();
}

function isTopDialog(id: symbol) {
  return openDialogs.at(-1) === id;
}

export function hasOpenDialog() {
  return openDialogs.length > 0;
}

export function Modal({
  open,
  onClose,
  children,
  size = "md",
  ariaLabel,
  closeDisabled = false,
  showCloseButton = true,
  closeOnBackdrop = true,
  scrollableContent = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
  ariaLabel: string;
  closeDisabled?: boolean;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  scrollableContent?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<symbol>(Symbol("dialog"));
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  }, [onClose, closeDisabled]);

  useEffect(() => {
    // Portals need the browser body, so render after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const rememberPointerTarget = (event: PointerEvent) => {
      const target = event.target;
      lastPointerTarget =
        target instanceof Element
          ? target.closest<HTMLElement>(FOCUSABLE_SELECTOR)
          : null;
    };
    document.addEventListener("pointerdown", rememberPointerTarget, true);
    return () => document.removeEventListener("pointerdown", rememberPointerTarget, true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) return;

    const activeElement = document.activeElement as HTMLElement | null;
    const previouslyFocused =
      activeElement && activeElement !== document.body ? activeElement : lastPointerTarget;
    const panel = panelRef.current;
    const dialogId = idRef.current;
    registerDialog(dialogId);

    const focusable = panel
      ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
          (element) => !element.hasAttribute("data-dialog-close")
        )
      : [];
    const initialFocus = panel?.querySelector<HTMLElement>("[data-dialog-autofocus]") ?? focusable[0];
    (initialFocus ?? panel)?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (!isTopDialog(dialogId)) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!closeDisabledRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;

      // Keep Tab cycling inside the dialog.
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!active || !panel.contains(active) || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      unregisterDialog(dialogId);
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
      lastPointerTarget = null;
    };
  }, [open, mounted]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      onClick={(event) => {
        if (
          closeOnBackdrop &&
          !closeDisabledRef.current &&
          event.target === event.currentTarget &&
          isTopDialog(idRef.current)
        ) {
          onCloseRef.current();
        }
      }}
      className="dialog-overlay fade-in bg-zinc-900/55 backdrop-blur-sm"
      data-dialog-overlay
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`dialog-panel modal-pop relative flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)] outline-none ${size === "lg" ? "max-w-3xl" : "max-w-lg"}`}
        data-dialog-panel
      >
        {showCloseButton && (
          <button
            type="button"
            aria-label="Close dialog"
            data-dialog-close
            onClick={() => {
              if (!closeDisabledRef.current) onCloseRef.current();
            }}
            disabled={closeDisabled}
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-zinc-500 transition-colors hover:bg-[#fdeeef] hover:text-[#c8102e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
        <div
          className={
            scrollableContent
              ? "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
              : "flex min-h-0 flex-1 flex-col overflow-hidden"
          }
          data-dialog-content
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
