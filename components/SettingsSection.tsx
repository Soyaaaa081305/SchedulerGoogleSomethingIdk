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
import { syncScheduleBacklog } from "@/lib/scheduleClient";

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

function getTimeZoneOptions(): string[] | null {
  try {
    const intlWithList = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    return intlWithList.supportedValuesOf ? intlWithList.supportedValuesOf("timeZone") : null;
  } catch {
    return null;
  }
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
  const [timeZoneOptions, setTimeZoneOptions] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingTerm, setSavingTerm] = useState(false);
  const [syncState, setSyncState] = useState<{ busy: boolean; result: string | null; error: string | null }>({ busy: false, result: null, error: null });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingCleanup, setConfirmingCleanup] = useState(false);
  const [confirmingDeleteData, setConfirmingDeleteData] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const [icalUrl, setIcalUrl] = useState<string | null>(null);
  const [icalCopied, setIcalCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const options = getTimeZoneOptions();
    if (options) {
      // Server and browser ICU builds can name historical zones differently.
      // Load the browser's list after hydration to keep the initial markup stable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeZoneOptions(options);
    }
  }, []);

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

  useEffect(() => {
    fetch("/api/ical/token")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.feedUrl) setIcalUrl(d.feedUrl);
      })
      .catch(() => {});
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
        "Notifications are enabled — you'll get a nightly push with tomorrow's classes."
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
          "Reminder is active — you'll get a nightly notification with tomorrow's classes."
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

  const patchSettingsField = async (body: Record<string, unknown>, successMessage: string) => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { settings: SettingsDTO } | null;
      if (!res.ok || !data) throw new Error("Could not save settings");
      onSettingsChange(data.settings);
      toast("success", successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setSyncState({ busy: true, result: null, error: null });
    setError(null);
    setNotice(null);
    try {
      const data = await syncScheduleBacklog();
      const count = data.created + data.repaired;
      if (data.failed > 0) {
        const msg = `${count} class${count === 1 ? "" : "es"} synced; ${data.failed} remain unsynced. ${data.firstError ?? "Retry in a moment."}`;
        setSyncState({ busy: false, result: null, error: msg });
        toast("info", msg);
      } else if (count > 0) {
        const msg = `Synced ${count} class${count > 1 ? "es" : ""} to Google Calendar.`;
        setSyncState({ busy: false, result: msg, error: null });
        toast("success", msg);
      } else {
        const msg = data.firstError ?? "All classes are already synced, or Google Calendar is not connected.";
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

  const exportData = async () => {
    try {
      const res = await fetch("/api/user/export");
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string })?.error ?? "Export failed");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scheduler-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("success", "Your data has been exported.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  const deleteData = async () => {
    setDeletingData(true);
    try {
      const res = await fetch("/api/user/delete", { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "Delete failed");
      setConfirmingDeleteData(false);
      toast("success", "All your schedule data has been deleted.");
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingData(false);
    }
  };

  const isSelected = (m: number) => {
    if (!settings?.semesterEnd) return m === 3;
    return Math.abs(new Date(settings.semesterEnd).getTime() - new Date(termEndFor(m)).getTime()) < 24 * 60 * 60 * 1000;
  };

  return (
    <Card title="Settings">
      <div className="divide-y divide-zinc-100">
        <div className="pb-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-900">Daily reminder</p>
              <p className="text-sm text-zinc-500">
                A nightly push listing your next day&apos;s classes.
              </p>
            </div>
            <Toggle checked={isOn} onChange={(v) => void enableReminder(v)} disabled={busy} />
          </div>

          {settings && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:gap-4">
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                Reminder time
                <span className="flex items-center gap-2">
                  <input
                    type="time"
                    value={settings.reminderTime}
                    disabled={busy}
                    onChange={(e) => {
                      if (e.target.value) {
                        void patchSettingsField(
                          { reminderTime: e.target.value },
                          "Reminder time saved."
                        );
                      }
                    }}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
                  />
                  <span className="text-zinc-400">{formatReminderTime(settings.reminderTime)}</span>
                </span>
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-zinc-600">
                Timezone
                <select
                  value={settings.timezone}
                  disabled={busy}
                  onChange={(e) => {
                    void patchSettingsField({ timezone: e.target.value }, "Timezone saved.");
                  }}
                  className="w-full max-w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 sm:max-w-[16rem]"
                >
                  {(timeZoneOptions ?? [settings.timezone]).includes(settings.timezone) ? null : (
                    <option value={settings.timezone}>{settings.timezone}</option>
                  )}
                  {(timeZoneOptions ?? [settings.timezone]).map((tzName) => (
                    <option key={tzName} value={tzName}>
                      {tzName}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-zinc-400">
                The push arrives when it&apos;s this time in this timezone.
              </p>
            </div>
          )}

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

        <div className="py-5">
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
                  onClick={() => void saveSemesterEnd(termEndFor(m))}
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
          <div className="py-5">
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

        <div className="py-5">
          <p className="text-sm font-medium text-zinc-900">Calendar subscription (iCal)</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Works with Apple Calendar, Outlook, and Google Calendar — no connection needed. Copy the link and add it as a subscribed calendar; it stays in sync when you edit your schedule.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={icalUrl ?? "Loading…"}
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
              onFocus={(e) => e.target.select()}
              aria-label="iCal subscription URL"
            />
            <Button
              variant="secondary"
              disabled={!icalUrl}
              onClick={() => {
                if (!icalUrl) return;
                navigator.clipboard.writeText(icalUrl).then(() => {
                  setIcalCopied(true);
                  toast("success", "Subscription link copied — add it in your calendar app.");
                  setTimeout(() => setIcalCopied(false), 2000);
                });
              }}
            >
              {icalCopied ? "Copied!" : "Copy link"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-zinc-400">Keep this link private — anyone with it can see your class times.</p>
        </div>

        {connected && (
          <div className="pt-5">
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
          </div>
        )}

        <div className="pt-5">
          <p className="text-sm font-medium text-zinc-900">Data & privacy</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Export your data as JSON or delete all your schedule data. Deleting removes your classes, settings, and push subscriptions but keeps your account.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void exportData()}>
              Export my data
            </Button>
            <Button variant="danger" onClick={() => setConfirmingDeleteData(true)} disabled={deletingData}>
              Delete my data
            </Button>
          </div>
        </div>
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
        open={confirmingDeleteData}
        title="Delete all your data?"
        body="This will permanently delete all your classes, settings, and push subscriptions. Your Google Calendar events will remain — remove them manually if needed. This can't be undone."
        confirmLabel="Delete my data"
        danger
        busy={deletingData}
        onConfirm={() => void deleteData()}
        onCancel={() => setConfirmingDeleteData(false)}
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
