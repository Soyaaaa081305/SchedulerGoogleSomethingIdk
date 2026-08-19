"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import Header, { type UserInfo } from "@/components/Header";
import UploadCard from "@/components/UploadCard";
import ScheduleTable from "@/components/ScheduleTable";
import ReminderCard from "@/components/ReminderCard";
import type { ScheduleDTO, SettingsDTO } from "@/lib/types";

export interface TodaySummary {
  classesToday: string[];
  tasksDueToday: number;
  overdueTasks: number;
}

export interface InitialData {
  schedules: ScheduleDTO[];
  settings: SettingsDTO | null;
  connected: boolean;
  needsReconnect: boolean;
  lastSync: string | null;
  summary: TodaySummary;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard({ user, initial }: { user: UserInfo; initial: InitialData }) {
  const [schedules, setSchedules] = useState<ScheduleDTO[]>(initial.schedules);
  const [settings, setSettings] = useState<SettingsDTO | null>(initial.settings);
  const [connected, setConnected] = useState(initial.connected);
  const [needsReconnect, setNeedsReconnect] = useState(initial.needsReconnect);
  const [lastSync, setLastSync] = useState(initial.lastSync);

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
  }, []);

  const firstName = useMemo(() => (user.name ?? user.email ?? "").split(" ")[0], [user.name, user.email]);

  const onSaved = (s: ScheduleDTO) => {
    setSchedules((prev) => [s, ...prev.filter((x) => x.id !== s.id)]);
    setConnected(true);
    setNeedsReconnect(false);
    setLastSync(s.lastSyncedAt);
  };

  const stats = [
    {
      label: "Classes today",
      value: initial.summary.classesToday.length,
      detail:
        initial.summary.classesToday.length > 0
          ? initial.summary.classesToday.join(" · ")
          : "Free day — rest well.",
    },
    {
      label: "Due today",
      value: initial.summary.tasksDueToday,
      detail:
        initial.summary.tasksDueToday > 0
          ? "Check the Tasks & BBL page."
          : "Nothing due today.",
    },
    {
      label: "Overdue",
      value: initial.summary.overdueTasks,
      detail:
        initial.summary.overdueTasks > 0
          ? "Finish these asap."
          : "All clear.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f7]">
      <Header user={user} connected={connected} />

      {!connected && (
        <div className="border-b border-[#f3c8cf] bg-[#fdeeef]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm text-[#8a0a1e]">
              {needsReconnect
                ? "Your Google sign-in is missing the calendar permission. Reconnect to let classes sync."
                : "Connect Google Calendar to automatically add your classes as weekly recurring events."}
            </p>
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="rounded-lg bg-[#c8102e] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#a50d26]"
            >
              {needsReconnect ? "Reconnect Google Calendar" : "Connect Google Calendar"}
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 pb-16">
        <section className="rounded-2xl bg-[#c8102e] p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-[#f5c6cd]">
            {greeting()}, {firstName || "classmate"}.
          </p>
          <h2 className="mt-1 text-xl font-black">
            {initial.summary.classesToday.length > 0
              ? `You have ${initial.summary.classesToday.length} class${
                  initial.summary.classesToday.length > 1 ? "es" : ""
                } today.`
              : "No classes today."}
          </h2>
          <p className="mt-1 text-sm text-[#f5c6cd]">
            {initial.summary.tasksDueToday > 0
              ? `${initial.summary.tasksDueToday} thing${
                  initial.summary.tasksDueToday > 1 ? "s" : ""
                } due today — don't forget.`
              : "Nothing due today. Still, double-check your tasks before sleeping."}
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {s.label}
              </p>
              <p className="mt-1 text-2xl font-black text-zinc-900">{s.value}</p>
              <p className="mt-1 truncate text-xs text-zinc-500" title={s.detail}>
                {s.detail}
              </p>
            </div>
          ))}
        </section>

        <UploadCard onSaved={onSaved} />
        <ScheduleTable schedules={schedules} onChange={setSchedules} />
        <ReminderCard settings={settings} onSettingsChange={setSettings} />

        {lastSync && (
          <p className="text-center text-xs text-zinc-400">
            Last calendar sync: {new Date(lastSync).toLocaleString()}. The
            nightly reminder runs at 9:00 PM via a free Vercel cron.
          </p>
        )}

        <footer className="border-t border-zinc-200 pt-4 text-center text-xs text-zinc-400">
          SkeduAI — made for students of Mapúa Malayan Colleges Laguna. No more
          makakalimutin.
        </footer>
      </main>
    </div>
  );
}