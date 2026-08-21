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
  onCleanupAggressive,
  onCleanupAll,
}: {
  settings: SettingsDTO | null;
  onSettingsChange: (s: SettingsDTO) => void;
  connected: boolean;
  cleaning: boolean;
  onCleanup: () => void;
  onCleanupAggressive: () => void;
  onCleanupAll: () => void;
}) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingTerm, setSavingTerm] = useState(false);
  const [syncState, setSyncState] = useState<{ busy: boolean; result: string | null; error: string | null }>({ busy: false, result: null, error: null });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingCleanup, setConfirmingCleanup] = useState(false);
  const [confirmingAggressive, setConfirmingAggressive] = useState(false);
  const [confirmingNuclear, setConfirmingNuclear] = useState(false);
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
      const data = (await res.json().catch(() => null)) as { settings: SettingsDTO } | null;
      if (!res.ok || !data) throw new Error("Could not save settings");
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
      const data = (await res.json().catch(() => null)) as { settings: SettingsDTO } | null;
      if (!res.ok || !data) throw new Error("Could not save term length");
      onSettingsChange(data.settings);
      toast("success", "Term length saved — weekly classes now end on " + endOfTermLabel(data.settings.semesterEnd));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save term length");
    } finally {
      setSavingTerm(false);
    }
  };

  const syncNow = async () => {
    setSyncState({ busy: true, result: null, error: null });
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/schedules/sync", { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        created?: number;
        failed?: number;
        firstError?: string;
      } | null;
      if (!res.ok) throw new Error(data?.firstError ?? "Could not sync");
      const count = data?.created ?? 0;
      if (count > 0) {
        setSyncState({ busy: false, result: `Synced ${count} class${count > 1 ? "es" : ""} to Google Calendar.`, error: null });
        toast("success", `Synced ${count} class${count > 1 ? "es" : ""} to Google Calendar.`);
      } else {
        const msg = data?.firstError ?? "All classes are already synced, or Google Calendar is not connected.";
        setSyncState({ busy: false, result: null, error: msg });
        toast("info", msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not sync classes";
      setSyncState({ busy: false, result: null, error: msg });
      toast("error", msg);
    } finally {
      setSyncState((s) => ({ ...s, busy: false }));
    }
  };

const isSelected = (m: number) => {
    if (!settings?.semesterEnd) return m === 3;
    return Math.abs(
      new Date(settings.semesterEnd).getTime() - new Date(termEndFor(m)).getTime()
    ) < 24 * 60 * 60 * 1000;
  };

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
        </div>

        <div className="py-4">
          <p className="text-sm font-medium text-zinc-900">Term length</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Weekly classes repeat until this date (default: 3 months — one MCL
            trimester). Currently ends {endOfTermLabel(settings?.semesterEnd ?? null)}.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {TERM_OPTIONS.map((m) => {
              const active = isSelected(m);
              return (
                <button
                  key={m}
                  type="button"
                  disabled={savingTerm}
                  aria-pressed={active}
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
                !TERM_OPTIONS.some(isSelected) && settings?.semesterEnd
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
          <div className="py-4">
            <p className="text-sm font-medium text-zinc-900">Sync to Google Calendar</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Push all unsynced classes to your Google Calendar. Classes already
              synced won&apos;t be duplicated.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => void syncNow()}
                disabled={syncState.busy}
              >
                {syncState.busy ? "Syncing…" : "Sync now"}
              </Button>
              {syncState.result && (
                <span className="text-sm text-green-600">{syncState.result}</span>
              )}
              {syncState.error && (
                <span className="text-sm text-[#c8102e]">{syncState.error}</span>
              )}
            </div>
          </div>
        )}

        {connected && (
          <div className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">Calendar cleanup</p>
                <p className="text-sm text-zinc-500">
                  Removes leftover class events in Google Calendar that are no
                  longer in your schedule — matched by name. Personal events
                  are never touched.
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
              <div>
                <p className="text-sm font-medium text-zinc-900">Remove all old classes</p>
                <p className="text-sm text-zinc-500">
                  Deletes every weekly recurring event that looks like a class
                  (weekday, daytime) — even old ones from before you started
                  using Scheduler. Use this if you still see stale events.
                </p>
              </div>
              {cleaning ? (
                <Spinner label="Cleaning…" />
              ) : (
                <Button variant="danger" onClick={() => setConfirmingAggressive(true)}>
                  Remove all old classes
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-4">
              <div>
                <p className="text-sm font-medium text-zinc-900">Delete everything from calendar</p>
                <p className="text-sm text-zinc-500">
                  Removes every event on your Google Calendar except your
                  currently synced classes. Your schedule here is not affected.
                </p>
              </div>
              {cleaning ? (
                <Spinner label="Deleting…" />
              ) : (
                <Button variant="danger" onClick={() => setConfirmingNuclear(true)}>
                  Delete everything
                </Button>
              )}
            </div>
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

      <ConfirmModal
        open={confirmingAggressive}
        title="Remove all old class events?"
        body="This will delete every weekly recurring event during daytime hours on your calendar — even events from before you started using Scheduler. Your current synced classes will be kept. This can't be undone."
        confirmLabel="Remove all old classes"
        danger
        busy={cleaning}
        onConfirm={() => {
          setConfirmingAggressive(false);
          onCleanupAggressive();
        }}
        onCancel={() => setConfirmingAggressive(false)}
      />

      <ConfirmModal
        open={confirmingNuclear}
        title="Delete everything from Google Calendar?"
        body="This will remove every event on your Google Calendar — including personal events, meetings, anything. Only your currently synced Scheduler classes will remain. This can't be undone."
        confirmLabel="Delete everything"
        danger
        busy={cleaning}
        onConfirm={() => {
          setConfirmingNuclear(false);
          onCleanupAll();
        }}
        onCancel={() => setConfirmingNuclear(false)}
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