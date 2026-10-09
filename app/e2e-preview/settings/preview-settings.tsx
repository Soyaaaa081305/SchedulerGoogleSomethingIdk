"use client";

import SettingsSection from "@/components/SettingsSection";
import type { SettingsDTO } from "@/lib/types";

const settings: SettingsDTO = {
  reminderEnabled: false,
  reminderTime: "21:00",
  timezone: "Asia/Manila",
  semesterEnd: null,
};

export default function PreviewSettings() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl space-y-6 bg-[#f6f6f7] px-4 py-6">
      <h1 className="text-lg font-black text-zinc-900">Settings</h1>
      <SettingsSection
        settings={settings}
        onSettingsChange={() => {}}
        connected
        cleaning={false}
        onCleanup={() => {}}
      />
    </main>
  );
}
