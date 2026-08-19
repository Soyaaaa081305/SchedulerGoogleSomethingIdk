"use client";

import { useEffect, useMemo, useState } from "react";
import Header, { type UserInfo } from "@/components/Header";
import ConnectBanner from "@/components/ConnectBanner";
import UploadCard from "@/components/UploadCard";
import ScheduleTable from "@/components/ScheduleTable";
import OnboardingModal, { useOnboarding } from "@/components/OnboardingModal";
import type { ScheduleDTO, SettingsDTO } from "@/lib/types";

export interface TodaySummary {
  classesToday: string[];
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
  const onboarding = useOnboarding(initial.schedules.length === 0);

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
  }, []);

  const firstName = useMemo(
    () => (user.name ?? user.email ?? "").split(" ")[0],
    [user.name, user.email]
  );

  const onSaved = (s: ScheduleDTO) => {
    setSchedules((prev) => [s, ...prev.filter((x) => x.id !== s.id)]);
    setConnected(true);
    setNeedsReconnect(false);
  };

  const todayList = initial.summary.classesToday;

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f7]">
      <Header user={user} connected={connected} />
      <ConnectBanner connected={connected} needsReconnect={needsReconnect} />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 pb-16">
        <section
          className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg sm:p-8"
          style={{
            background: "linear-gradient(135deg, #c8102e 0%, #a50d26 55%, #8a0a1e 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #ffffff 0%, transparent 70%)" }}
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-[#f5c6cd]">
            {greeting()}, {firstName || "classmate"}.
          </p>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">
            {todayList.length > 0
              ? `${todayList.length} class${todayList.length > 1 ? "es" : ""} today`
              : "No classes today."}
          </h2>
          {todayList.length > 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-[#f5c6cd]">
              {todayList.slice(0, 3).join(" · ")}
              {todayList.length > 3 && ` +${todayList.length - 3} more`} — see
              your full schedule below.
            </p>
          ) : (
            <p className="mt-2 text-sm text-[#f5c6cd]">
              Free day. Review tomorrow&apos;s classes before you sleep.
            </p>
          )}
        </section>

        <UploadCard onSaved={onSaved} settings={settings} onSettingsChange={setSettings} />
        <ScheduleTable schedules={schedules} onChange={setSchedules} />

        <footer className="border-t border-zinc-200 pt-4 text-center text-xs text-zinc-400">
          Scheduler — made for students of Mapúa Malayan Colleges Laguna. No
          more makakalimutin.
        </footer>
      </main>

      <OnboardingModal open={onboarding.open} onClose={onboarding.close} />
    </div>
  );
}