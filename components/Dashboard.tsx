"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header, { type UserInfo } from "@/components/Header";
import ConnectBanner from "@/components/ConnectBanner";
import UploadCard from "@/components/UploadCard";
import ScheduleTable from "@/components/ScheduleTable";
import OnboardingModal, { useOnboarding } from "@/components/OnboardingModal";
import CommandPalette from "@/components/CommandPalette";
import { describeNextOccurrence, nextOccurrenceInfo } from "@/lib/scheduleUtils";
import { weekdayInTz } from "@/lib/days";
import type { ScheduleDTO, SettingsDTO } from "@/lib/types";
import { loadSchedules, syncScheduleBacklog } from "@/lib/scheduleClient";
import { useToast } from "@/components/ToastProvider";

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
  const [syncingIds, setSyncingIds] = useState<Set<string>>(() => new Set());
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Ticks every 30s so the "next class" countdown stays honest.
  const [, setTick] = useState(0);
  const pendingSyncIds = useRef(new Set<string>());
  const syncRunning = useRef(false);
  const { toast } = useToast();
  const onboarding = useOnboarding(initial.schedules.length === 0);

  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const timezone = settings?.timezone ?? "Asia/Manila";

  const firstName = useMemo(
    () => (user.name ?? user.email ?? "").split(" ")[0],
    [user.name, user.email]
  );

  const syncPendingSchedules = useCallback(async () => {
    if (syncRunning.current) return;
    syncRunning.current = true;
    try {
      while (pendingSyncIds.current.size > 0) {
        const batchIds = [...pendingSyncIds.current];
        pendingSyncIds.current.clear();
        try {
          const summary = await syncScheduleBacklog();
          if (summary.created + summary.repaired > 0) {
            setConnected(true);
            setNeedsReconnect(false);
          }
          const latest = await loadSchedules().catch(() => null);
          if (latest) setSchedules(latest);
          setSyncingIds((current) => {
            const next = new Set(current);
            for (const id of batchIds) next.delete(id);
            for (const result of summary.results) next.delete(result.scheduleId);
            return next;
          });
          if (summary.failed > 0) {
            toast(
              "info",
              `${summary.failed} class${summary.failed === 1 ? " is" : "es are"} saved but not synced. Retry in Settings with Sync now.`
            );
          }
        } catch {
          setSyncingIds((current) => {
            const next = new Set(current);
            for (const id of batchIds) next.delete(id);
            return next;
          });
          toast("error", "Your classes are saved. Calendar sync is pending; retry in Settings with Sync now.");
        }
      }
    } finally {
      syncRunning.current = false;
    }
  }, [toast]);

  const startCalendarSync = useCallback((saved: ScheduleDTO[]) => {
    if (saved.length === 0) return;
    const savedIds = new Set(saved.map((schedule) => schedule.id));
    setSyncingIds((current) => new Set([...current, ...savedIds]));
    for (const schedule of saved) pendingSyncIds.current.add(schedule.id);
    void syncPendingSchedules();
  }, [syncPendingSchedules]);

  const onSaved = useCallback((saved: ScheduleDTO[], deferCalendarSync = false) => {
    if (saved.length === 0) return;
    const savedIds = new Set(saved.map((schedule) => schedule.id));
    setSchedules((current) => [
      ...saved,
      ...current.filter((schedule) => !savedIds.has(schedule.id)),
    ]);
    if (!deferCalendarSync) startCalendarSync(saved);
  }, [startCalendarSync]);

  const onSavedOne = useCallback((schedule: ScheduleDTO) => onSaved([schedule]), [onSaved]);

  // Derived client-side so adding/deleting classes updates the hero instantly.
  const weekday = mounted ? weekdayInTz(timezone) : null;
  const todayList =
    weekday === null
      ? initial.summary.classesToday
      : schedules
          .filter((s) => s.daysOfWeek.includes(weekday))
          .map((s) => s.courseName);

  const nextInfo = mounted ? nextOccurrenceInfo(schedules, timezone) : null;

  return (
    <div
      className="flex min-h-screen flex-col bg-[#f6f6f7]"
      data-dashboard-ready={mounted ? "true" : "false"}
    >
      <Header user={user} onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
      <ConnectBanner connected={connected} needsReconnect={needsReconnect} />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6 pb-16">
        <section
          className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg sm:p-8"
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
          <h2 className="mt-1 text-lg font-black">
            {todayList.length > 0
              ? `${todayList.length} class${todayList.length > 1 ? "es" : ""} today`
              : "No classes today."}
          </h2>
          {nextInfo ? (
            <p className="mt-2 text-sm leading-relaxed text-white/95">{describeNextOccurrence(nextInfo)}</p>
          ) : todayList.length > 0 ? (
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

        <UploadCard
          onSaved={onSaved}
          onSyncRequested={startCalendarSync}
          existing={schedules}
          settings={settings}
          onSettingsChange={setSettings}
        />
        <ScheduleTable
          schedules={schedules}
          onChange={setSchedules}
          onAdded={onSavedOne}
          syncingIds={syncingIds}
          timezone={timezone}
          semesterEnd={settings?.semesterEnd ?? null}
        />

        <footer className="border-t border-zinc-200 pt-4 text-center text-xs text-zinc-400">
          Scheduler — made for students of Mapúa Malayan Colleges Laguna. No
          more makakalimutin.
        </footer>
      </main>

      <CommandPalette
        schedules={schedules}
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />
      <OnboardingModal open={onboarding.open} onClose={onboarding.close} />
    </div>
  );
}
