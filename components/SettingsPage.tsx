"use client";

import Link from "next/link";
import { useState } from "react";
import Header, { type UserInfo } from "@/components/Header";
import ConnectBanner from "@/components/ConnectBanner";
import SettingsSection from "@/components/SettingsSection";
import { useToast } from "@/components/ToastProvider";
import type { SettingsDTO } from "@/lib/types";

export default function SettingsPage({
  user,
  settings,
  connected,
  needsReconnect,
  lastSync,
}: {
  user: UserInfo;
  settings: SettingsDTO | null;
  connected: boolean;
  needsReconnect: boolean;
  lastSync: string | null;
}) {
  const [settingsState, setSettingsState] = useState<SettingsDTO | null>(settings);
  const [cleaning, setCleaning] = useState(false);
  const { toast } = useToast();

  const cleanupCalendar = async (mode: "normal" | "aggressive" | "all") => {
    setCleaning(true);
    try {
      let url = "/api/calendar/cleanup";
      if (mode === "aggressive") url = "/api/calendar/cleanup?aggressive=1";
      if (mode === "all") url = "/api/calendar/cleanup-all";
      const res = await fetch(url, { method: "POST" });
      const data = (await res.json().catch(() => null)) as {
        deleted?: number;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "Cleanup failed");
      toast(
        "success",
        data!.deleted! > 0
          ? `Removed ${data!.deleted} event${data!.deleted! > 1 ? "s" : ""} from Google Calendar.`
          : "Nothing to clean — your calendar matches your schedule."
      );
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Cleanup failed");
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f7]">
      <Header user={user} />
      <ConnectBanner connected={connected} needsReconnect={needsReconnect} />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-zinc-900">Settings</h2>
            <p className="text-sm text-zinc-500">
              Reminder, term length, and calendar maintenance.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            ← Back to schedule
          </Link>
        </div>

        <SettingsSection
          settings={settingsState}
          onSettingsChange={setSettingsState}
          connected={connected}
          cleaning={cleaning}
          onCleanup={() => void cleanupCalendar("normal")}
          onCleanupAggressive={() => void cleanupCalendar("aggressive")}
          onCleanupAll={() => void cleanupCalendar("all")}
        />

        {lastSync && (
          <p className="text-center text-xs text-zinc-400">
            Last calendar sync: {new Date(lastSync).toLocaleString()}. The
            nightly reminder is delivered at your configured time via a free
            Vercel cron.
          </p>
        )}

        <footer className="border-t border-zinc-200 pt-4 text-center text-xs text-zinc-400">
          Scheduler — made for students of Mapúa Malayan Colleges Laguna. No
          more makakalimutin.
        </footer>
      </main>
    </div>
  );
}