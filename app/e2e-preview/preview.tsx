import { notFound } from "next/navigation";
import Dashboard, { type InitialData } from "@/components/Dashboard";
import type { SettingsDTO } from "@/lib/types";

const previewSettings: SettingsDTO = {
  reminderEnabled: false,
  reminderTime: "21:00",
  timezone: "Asia/Manila",
  semesterEnd: null,
};

const initialData: InitialData = {
  schedules: [
    {
      id: "preview-course",
      courseName: "CS 101",
      daysOfWeek: ["MON"],
      startTime: "08:00",
      endTime: "09:00",
      room: "B302",
      googleEventId: null,
      lastSyncedAt: null,
      synced: false,
    },
  ],
  settings: previewSettings,
  connected: false,
  needsReconnect: false,
  lastSync: null,
  summary: { classesToday: [] },
};

export function E2EPreview({ onboarding = false }: { onboarding?: boolean }) {
  if (process.env.NODE_ENV !== "development" || process.env.E2E_TEST_MODE !== "true") {
    notFound();
  }

  return (
    <Dashboard
      user={{ name: "Test Student", email: "student@example.test" }}
      initial={onboarding ? { ...initialData, schedules: [] } : initialData}
    />
  );
}
