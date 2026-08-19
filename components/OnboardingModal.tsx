"use client";

import { useEffect, useState } from "react";
import { Modal, Button } from "@/components/ui";

const STEPS = [
  {
    icon: "🗓️",
    title: "Welcome to Scheduler",
    body: "Your class timetable, your Google Calendar, and a nightly reminder — all in one place. Built for Mapúa MCL students.",
  },
  {
    icon: "📷",
    title: "Upload your timetable",
    body: "Take a photo or screenshot of your schedule and upload it. The AI reads the classes for you — no manual typing.",
  },
  {
    icon: "🔍",
    title: "Review before syncing",
    body: "Check every class the AI found, pick how long your term runs, and confirm. Only what you approve goes to your calendar.",
  },
  {
    icon: "🌙",
    title: "Nightly reminder",
    body: "At 9:00 PM you'll get a push notification with the next day's classes. Never walk into the wrong room again.",
  },
  {
    icon: "✅",
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
          <span className="text-4xl">{current.icon}</span>
          <button
            type="button"
            aria-label="Skip tour"
            onClick={onClose}
            className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-800"
          >
            Skip tour
          </button>
        </div>

        <h2 className="mt-4 text-xl font-black text-zinc-900 sm:text-2xl">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{current.body}</p>

        <div className="mt-6 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
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