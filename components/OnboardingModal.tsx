"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Modal, Button } from "@/components/ui";

const STEP_ICONS: Record<string, ReactNode> = {
  calendar: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <path strokeLinecap="round" d="M3 9h18M8 2v4M16 2v4" />
    </svg>
  ),
  upload: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16v2a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-2M8 10l4-4 4 4M12 6v12" />
    </svg>
  ),
  review: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h6" />
    </svg>
  ),
  moon: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  check: (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
};

const STEPS = [
  {
    icon: "calendar",
    title: "Welcome to Scheduler",
    body: "Your class timetable, your Google Calendar, and a nightly reminder - all in one place. Built for Mapúa MCL students.",
  },
  {
    icon: "upload",
    title: "Upload your timetable",
    body: "Take a photo or screenshot of your schedule and upload it. The AI reads the classes for you - no manual typing.",
  },
  {
    icon: "review",
    title: "Review before syncing",
    body: "Check every class the AI found, pick how long your term runs, and confirm. Only what you approve goes to your calendar.",
  },
  {
    icon: "moon",
    title: "Nightly reminder",
    body: "At 9:00 PM you'll get a push notification with the next day's classes. Never walk into the wrong room again.",
  },
  {
    icon: "check",
    title: "You're all set",
    body: "Everything syncs to Google Calendar as weekly recurring events. Edit or delete classes anytime, right here.",
  },
];

export function useOnboarding(show: boolean) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [show]);

  const close = () => setOpen(false);

  return { open, close };
}

export default function OnboardingModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) {
      onClose();
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "1.25rem" }} className="sm:p-8">
        <div className="flex items-start justify-between">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdeeef] text-[#c8102e] shadow-sm">
            {STEP_ICONS[current.icon]}
          </span>
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 text-lg font-black text-zinc-900">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{current.body}</p>

        <div className="mt-6 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i === step ? "bg-[#c8102e]" : "bg-zinc-200"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          <Button onClick={() => void next()}>
            {isLast ? "Get started" : "Next"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}