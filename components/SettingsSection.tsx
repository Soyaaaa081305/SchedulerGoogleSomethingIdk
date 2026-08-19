"use client";

import { useEffect, useState } from "react";
import {
  Card,
  Button,
  Toggle,
  ErrorBanner,
  NoticeBanner,
  Spinner,
} from "@/components/ui";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import { ensurePushSubscribed } from "@/lib/pushClient";
import { TERM_OPTIONS, termEndFor } from "@/lib/term";
import type { SettingsDTO } from "@/lib/types";

function formatReminderTime(time: string): string {
  try {
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  } catch {
    return time;
  }
}

function endOfTermLabel(iso: string | null): string {
  if (!iso) return "Not set";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SettingsSection({
  settings,
  onSettingsChange,
  connected,
  cleaning,
  onCleanup,
}: {
  settings: SettingsDTO | null;
  onSettingsChange: (s: SettingsDTO) => void;
  connected: boolean;
  cleaning: boolean;
  onCleanup: () => void;
}) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savingTerm, setSavingTerm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingCleanup, setConfirmingCleanup] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled) setSubscribed(Boolean(sub));
      })
      .catch(() => {
        if (!cancelled) setSubscribed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isOn = Boolean(settings?.reminderEnabled);

  const subscribeNow = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await ensurePushSubscribed();
      setSubscribed(true);
      setNotice(
        "Notifications are enabled — you'll get a push every night at 9:00 PM with tomorrow's classes."
      );
      toast("success", "Notifications enabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enable notifications");
    } finally {
      setBusy(false);
    }
  };

  const enableReminder = async (enabled: boolean) => {
    if (!settings) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (enabled) {
        await ensurePushSubscribed();
        setSubscribed(true);
        setNotice(
          "Reminder is active — you'll get a notification every night at 9:00 PM with tomorrow's classes."
        );
      } else {
        setSubscribed(false);
      }

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderEnabled: enabled }),
      });
      const data = (await res.json()) as { settings: SettingsDTO };
      if (!res.ok) throw new Error("Could not save settings");
      onSettingsChange(data.settings);
      toast(
        enabled ? "success" : "info",
        enabled ? "Daily reminder enabled." : "Daily reminder disabled."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update reminder settings");
    } finally {
      setBusy(false);
    }
  };

  const saveSemesterEnd = async (semesterEnd: string | null) => {
    setSavingTerm(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterEnd }),
      });
      const data = (await res.json()) as { settings: SettingsDTO };
      if (!res.ok) throw new Error("Could not save term length");
      onSettingsChange(data.settings);
      toast("success", "Term length saved — weekly classes now end on " + endOfTermLabel(data.settings.semesterEnd));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save term length");
    } finally {
      setSavingTerm(false);
    }
  };

  const testReminder = async () => {
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/reminder/test", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        sent?: boolean;
        error?: string;
        message?: { body: string };
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "Could not send test reminder");
      setNotice(`Test reminder sent. It said: "${data?.message?.body ?? "check your stuff today"}"`);
      toast("success", "Test reminder sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send test reminder");
    } finally {
      setTesting(false);
    }
  };

  const selectedMonths = settings?.semesterEnd
    ? TERM_OPTIONS.find(
        (m) =>
          Math.abs(
            new Date(settings.semesterEnd!).getTime() - new Date(termEndFor(m)).getTime()
          ) < 24 * 60 * 60 * 1000
      )
    : null;

  return (
    <Card title="Settings">
      <div className="divide-y divide-zinc-100">
        <div className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-900">Daily reminder</p>
              <p className="text-sm text-zinc-500">
                {settings ? formatReminderTime(settings.reminderTime) : "9:00 PM"} every day
                {settings?.timezone ? ` (${settings.timezone})` : ""} — a push
                notification listing your next day&apos;s classes.
              </p>
            </div>
            <Toggle checked={isOn} onChange={(v) => void enableReminder(v)} disabled={busy} />
          </div>

          {busy && (
            <div className="mt-3">
              <Spinner label={isOn ? "Enabling…" : "Disabling…"} />
            </div>
          )}

          {subscribed === false && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-sm text-amber-700">
                {isOn
                  ? "No push subscription found — enable browser notifications to receive the reminder."
                  : "Your browser hasn't asked for notification permission yet."}
              </p>
              <Button
                variant="secondary"
                onClick={() => void subscribeNow()}
                disabled={busy}
                className="ml-auto"
              >
                {busy ? "Enabling…" : "Allow notifications"}
              </Button>
            </div>
          )}

          <div className="mt-3">
            <Button
              variant="secondary"
              onClick={() => void testReminder()}
              disabled={testing || !isOn || subscribed !== true}
            >
              {testing ? "Sending…" : "Test reminder"}
            </Button>
          </div>
        </div>

        <div className="py-4">
          <p className="text-sm font-medium text-zinc-900">Term length</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Weekly classes repeat until this date (default: 3 months — one MCL
            trimester). Currently ends {endOfTermLabel(settings?.semesterEnd ?? null)}.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {TERM_OPTIONS.map((m) => {
              const active =
                selectedMonths === m &&
                !(
                  settings?.semesterEnd &&
                  selectedMonths == null
                );
              return (
                <button
                  key={m}
                  type="button"
                  disabled={savingTerm}
                  onClick={() =>
                    void saveSemesterEnd(settings?.semesterEnd ? termEndFor(m) : termEndFor(m))
                  }
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                    active
                      ? "border-[#c8102e] bg-[#fdeeef] text-[#c8102e]"
                      : "border-zinc-300 text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  {m} month{m > 1 ? "s" : ""}
                </button>
              );
            })}
            <input
              type="date"
              disabled={savingTerm}
              value={
                selectedMonths == null && settings?.semesterEnd
                  ? new Date(settings.semesterEnd).toISOString().slice(0, 10)
                  : ""
              }
              onChange={(e) => {
                if (e.target.value) void saveSemesterEnd(new Date(e.target.value + "T23:59:59+08:00").toISOString());
              }}
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 disabled:opacity-50"
              aria-label="Custom term end date"
            />
          </div>
          {savingTerm && (
            <p className="mt-2 text-xs text-zinc-400">Saving…</p>
          )}
        </div>

        {connected && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div>
              <p className="text-sm font-medium text-zinc-900">Calendar cleanup</p>
              <p className="text-sm text-zinc-500">
                Removes leftover class events in Google Calendar that are no
                longer in your schedule here. Personal events are never touched.
              </p>
            </div>
            {cleaning ? (
              <Spinner label="Cleaning…" />
            ) : (
              <Button variant="secondary" onClick={() => setConfirmingCleanup(true)}>
                Clean up
              </Button>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmingCleanup}
        title="Clean up Google Calendar?"
        body="Only leftover class events created by Scheduler that are no longer in your schedule will be removed — your personal events are always kept."
        confirmLabel="Clean up calendar"
        busy={cleaning}
        onConfirm={() => {
          setConfirmingCleanup(false);
          onCleanup();
        }}
        onCancel={() => setConfirmingCleanup(false)}
      />

      {notice && (
        <div className="mt-4">
          <NoticeBanner message={notice} />
        </div>
      )}
      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
    </Card>
  );
}