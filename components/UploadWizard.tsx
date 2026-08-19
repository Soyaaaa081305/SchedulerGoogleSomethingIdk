"use client";

import { useMemo, useState } from "react";
import { Modal, Button, Toggle, Spinner, ErrorBanner } from "@/components/ui";
import { useToast } from "@/components/ToastProvider";
import { ensurePushSubscribed } from "@/lib/pushClient";
import { TERM_OPTIONS, TERM_LABELS, termEndFor } from "@/lib/term";
import type { ScheduleDTO, SettingsDTO } from "@/lib/types";
import type { ParsedCourse } from "@/lib/gemini";
import type { Row } from "@/components/UploadCard";
import { CourseRowEditor } from "@/components/UploadCard";

async function saveSchedule(row: ParsedCourse): Promise<ScheduleDTO> {
  const res = await fetch("/api/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  const data = (await res.json().catch(() => null)) as {
    schedule?: ScheduleDTO;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(data?.error ?? "Could not add to Google Calendar");
  }
  return data!.schedule!;
}

const STEPS = ["Review", "Term length", "Reminder", "Confirm"];

export default function UploadWizard({
  rows,
  onClose,
  onSaved,
  settings,
  onSettingsChange,
  onCleared,
}: {
  rows: Row[];
  onClose: () => void;
  onSaved: (s: ScheduleDTO) => void;
  settings: SettingsDTO | null;
  onSettingsChange: (s: SettingsDTO) => void;
  onCleared: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [rowsState, setRowsState] = useState<Row[]>(rows);
  const [semesterEnd, setSemesterEnd] = useState<string | null>(settings?.semesterEnd ?? null);
  const [reminderOn, setReminderOn] = useState(settings?.reminderEnabled ?? true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => rowsState.filter((r) => r.selected), [rowsState]);

  const patchSettings = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { settings: SettingsDTO };
    if (!res.ok) throw new Error("Could not save settings");
    onSettingsChange(data.settings);
  };

  const sync = async () => {
    if (selected.length === 0) return;
    setSyncing(true);
    setError(null);
    try {
      await patchSettings({ semesterEnd, reminderEnabled: reminderOn });
      if (reminderOn) {
        await ensurePushSubscribed().catch(() => {
          // Reminder preference is still saved; the user can re-enable later.
        });
      }
      for (const row of selected) {
        const dto = await saveSchedule({
          courseName: row.courseName,
          daysOfWeek: row.daysOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
          room: row.room,
        });
        onSaved(dto);
      }
      toast(
        "success",
        `Added ${selected.length} course${selected.length > 1 ? "s" : ""} to your schedule and Google Calendar.`
      );
      onCleared();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not sync your schedule";
      setError(message);
      toast("error", message);
    } finally {
      setSyncing(false);
    }
  };

  const customDate =
    semesterEnd && !TERM_OPTIONS.some((m) => Math.abs(new Date(semesterEnd).getTime() - new Date(termEndFor(m)).getTime()) < 24 * 60 * 60 * 1000)
      ? new Date(semesterEnd).toISOString().slice(0, 10)
      : "";

  return (
    <Modal open onClose={syncing ? () => {} : onClose} size="lg">
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-1.5">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-[#c8102e]" : "bg-zinc-200"
              }`}
            />
          ))}
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </p>

        {step === 0 && (
          <div className="mt-4">
            <h2 className="text-xl font-black text-zinc-900">Review your classes</h2>
            <p className="mt-1 text-sm text-zinc-600">
              The AI read {rowsState.length} course{rowsState.length > 1 ? "s" : ""}. Expand
              any row to edit the details, and untick anything you don&apos;t
              want synced.
            </p>
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
              {rowsState.map((row) => (
                <CourseRowEditor
                  key={row.id}
                  row={row}
                  onChange={(updated) =>
                    setRowsState((prev) =>
                      prev.map((r) => (r.id === updated.id ? updated : r))
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-4">
            <h2 className="text-xl font-black text-zinc-900">How long is your term?</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Your classes repeat weekly and stop when the term ends. Mapúa MCL
              runs three ~14-week trimesters per year — 3 months is the default.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {TERM_OPTIONS.map((m) => {
                const active =
                  semesterEnd !== null &&
                  Math.abs(
                    new Date(semesterEnd).getTime() - new Date(termEndFor(m)).getTime()
                  ) < 24 * 60 * 60 * 1000;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSemesterEnd(termEndFor(m))}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-[#c8102e] bg-[#fdeeef] text-[#c8102e]"
                        : "border-zinc-300 text-zinc-700 hover:border-zinc-400"
                    }`}
                  >
                    {TERM_LABELS[m]}
                  </button>
                );
              })}
            </div>
            <label className="mt-4 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              Or pick an exact end date:
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setSemesterEnd(e.target.value ? new Date(e.target.value + "T23:59:59+08:00").toISOString() : null);
                }}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
              />
            </label>
            {semesterEnd && (
              <p className="mt-3 text-sm text-zinc-500">
                Classes will repeat until{" "}
                <span className="font-semibold text-zinc-800">
                  {new Date(semesterEnd).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                .
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="mt-4">
            <h2 className="text-xl font-black text-zinc-900">Nightly reminder</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Get a push notification at 9:00 PM with tomorrow&apos;s classes.
              Your browser will ask for permission.
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-zinc-200 p-4">
              <div>
                <p className="text-sm font-medium text-zinc-900">Daily reminder</p>
                <p className="text-sm text-zinc-500">9:00 PM · Asia/Manila</p>
              </div>
              <Toggle checked={reminderOn} onChange={setReminderOn} />
            </div>
            {reminderOn && (
              <p className="mt-3 text-sm text-zinc-500">
                You can change the time or turn it off anytime in Settings.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="mt-4">
            <h2 className="text-xl font-black text-zinc-900">Almost there</h2>
            <ul className="mt-4 space-y-2 text-sm text-zinc-700">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#c8102e]">✓</span>
                <span>
                  <strong>{selected.length}</strong> course{selected.length > 1 ? "s" : ""} will
                  be added to Google Calendar as weekly recurring events
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#c8102e]">✓</span>
                <span>
                  Classes repeat until{" "}
                  <strong>
                    {semesterEnd
                      ? new Date(semesterEnd).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "the end of your term"}
                  </strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-[#c8102e]">✓</span>
                <span>
                  Daily reminder: <strong>{reminderOn ? "ON" : "OFF"}</strong>
                  {reminderOn && " (your browser will ask for notification permission)"}
                </span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-zinc-500">
              Missing classes can always be added again with another upload.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        )}

        {syncing && (
          <div className="mt-4">
            <Spinner label="Syncing to Google Calendar…" />
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || syncing}>
            Back
          </Button>
          <div className="flex items-center gap-2">
            {step < 3 && (
              <Button variant="ghost" onClick={onClose} disabled={syncing}>
                Cancel
              </Button>
            )}
            <Button
              onClick={() => {
                if (step === STEPS.length - 1) {
                  void sync();
                } else {
                  setStep((s) => s + 1);
                }
              }}
              disabled={syncing || (step === 0 && selected.length === 0)}
            >
              {step === STEPS.length - 1
                ? syncing
                  ? "Syncing…"
                  : `Sync ${selected.length} to Google Calendar`
                : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}