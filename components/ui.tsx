import type { ReactNode, ButtonHTMLAttributes } from "react";
import { useEffect } from "react";
import { DAYS, type Day } from "@/lib/days";

export const BRAND = {
  red: "bg-[#c8102e] text-white hover:bg-[#a50d26]",
  tint: "bg-[#fdeeef] text-[#a50d26]",
  chip: "bg-[#fdeeef] text-[#c8102e]",
  border: "border-[#f3c8cf]",
};

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[#c8102e]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-zinc-500">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-[#c8102e]" />
      {label && <span>{label}</span>}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-[#c8102e] text-white hover:bg-[#a50d26] disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
  danger: "bg-[#8a0a1e] text-white hover:bg-[#6d0818]",
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
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

export function NoticeBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-[#f3c8cf] bg-[#fdeeef] px-3 py-2 text-sm text-[#8a0a1e]">
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

export function Modal({
  open,
  onClose,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const maxWidth = size === "lg" ? "48rem" : "32rem";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
        padding: "1rem",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%",
          maxWidth,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: "1rem",
          background: "white",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
        }}
      >
        {children}
      </div>
    </div>
  );
}