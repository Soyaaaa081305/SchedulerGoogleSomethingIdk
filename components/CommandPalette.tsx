"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScheduleDTO } from "@/lib/types";

export default function CommandPalette({ schedules }: { schedules: ScheduleDTO[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return schedules.slice(0, 5);
    return schedules.filter((s) => s.courseName.toLowerCase().includes(query) || (s.room && s.room.toLowerCase().includes(query))).slice(0, 5);
  }, [schedules, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center bg-zinc-900/40 p-4 pt-[20vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search classes, or try “settings”…"
          className="w-full border-b border-zinc-100 bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
        />
        <div className="max-h-64 overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/settings");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50"
          >
            <span className="text-zinc-400">⚙️</span> Go to Settings
          </button>
          {filtered.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-zinc-50">
              <span className="font-medium text-zinc-900">{s.courseName}</span>
              <span className="text-xs text-zinc-500">
                {s.daysOfWeek} {s.startTime} {s.room ?? ""}
              </span>
            </div>
          ))}
          {filtered.length === 0 && q && <p className="px-3 py-4 text-center text-sm text-zinc-400">No matches.</p>}
        </div>
        <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-400">Press ⌘K to close · Esc to dismiss</div>
      </div>
    </div>
  );
}
