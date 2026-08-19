"use client";

import { useEffect, useState } from "react";
import { Card, Button, Toggle, ErrorBanner, NoticeBanner, Spinner } from "@/components/ui";
import { subscribePush } from "@/lib/pushClient";
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

export default function ReminderCard({
  settings,
  onSettingsChange,
}: {
  settings: SettingsDTO | null;
  onSettingsChange: (s: SettingsDTO) => void;
}) {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  const enableReminder = async (enabled: boolean) => {
    if (!settings) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (enabled) {
        const vapidRes = await fetch("/api/push/vapid");
        const vapid = (await vapidRes.json()) as { publicKey: string | null };
        if (!vapid.publicKey) {
          throw new Error("VAPID keys are not configured on the server yet. See README.");
        }
        const sub = await subscribePush(vapid.publicKey);
        if (!sub) {
          throw new Error("Notifications are blocked. Allow notifications in your browser to enable the reminder.");
        }
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: {
              endpoint: sub.endpoint,
              keys: {
                p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!))),
                auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!))),
              },
            },
          }),
        });
        if (!res.ok) throw new Error("Could not save your notification subscription");
        setSubscribed(true);
        setNotice("Reminder is active — you'll get a notification every night at 9:00 PM to double-check your classes, tasks, and due dates.");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update reminder settings");
    } finally {
      setBusy(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send test reminder");
    } finally {
      setTesting(false);
    }
  };

  const isOn = Boolean(settings?.reminderEnabled);

  return (
    <Card title="Daily reminder">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-900">
            Daily reminder: {isOn ? "ON" : "OFF"}
          </p>
          <p className="text-sm text-zinc-500">
            {settings ? formatReminderTime(settings.reminderTime) : "9:00 PM"} every day
            {settings?.timezone ? ` (${settings.timezone})` : ""}
          </p>
        </div>
        <Toggle checked={isOn} onChange={(v) => void enableReminder(v)} disabled={busy} />
      </div>

      <p className="mt-3 text-sm text-zinc-500">
        Every night you&apos;ll get a push notification to double-check your
        things: today&apos;s classes, due dates, and overdue tasks.
      </p>

      {busy && (
        <div className="mt-3">
          <Spinner label={isOn ? "Enabling…" : "Disabling…"} />
        </div>
      )}

      {subscribed === true && isOn && (
        <div className="mt-3">
          <NoticeBanner
            message={`Reminder is active — you'll get a notification at ${
              settings ? formatReminderTime(settings.reminderTime) : "9:00 PM"
            }.`}
          />
        </div>
      )}
      {subscribed === false && isOn && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Notifications are not enabled — toggle the reminder off and on to
          allow them.
        </div>
      )}
      {notice && !error && (
        <div className="mt-3">
          <NoticeBanner message={notice} />
        </div>
      )}
      {error && (
        <div className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}

      <div className="mt-4">
        <Button variant="secondary" onClick={() => void testReminder()} disabled={testing || !isOn}>
          {testing ? "Sending…" : "Test reminder"}
        </Button>
      </div>
    </Card>
  );
}