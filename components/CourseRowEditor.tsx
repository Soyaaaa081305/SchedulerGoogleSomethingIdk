"use client";

import { DayPicker } from "@/components/ui";
import type { ParsedCourse } from "@/lib/gemini";
import type { Day } from "@/lib/days";

export interface Row extends ParsedCourse {
  id: string;
  selected: boolean;
  /** Already on the user's schedule (same class, same time) — unticked by default. */
  duplicate?: boolean;
}

export function CourseRowEditor({
  row,
  onChange,
}: {
  row: Row;
  onChange: (row: Row) => void;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-3 ${
        row.duplicate ? "border-zinc-200 bg-zinc-50" : "border-zinc-200"
      }`}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={row.selected}
          onChange={(e) => onChange({ ...row, selected: e.target.checked })}
          className="h-4 w-4 accent-[#c8102e]"
          aria-label={`Select ${row.courseName}`}
        />
        <input
          type="text"
          value={row.courseName}
          onChange={(e) => onChange({ ...row, courseName: e.target.value })}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
          placeholder="Course name"
          aria-label={`Course name for row starting at ${row.startTime}`}
        />
        {row.duplicate && (
          <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-600">
            already saved
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-zinc-600">
          Start
          <input
            type="time"
            value={row.startTime}
            onChange={(e) => onChange({ ...row, startTime: e.target.value })}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
          />
        </label>
        <label className="flex items-center gap-1.5 text-zinc-600">
          End
          <input
            type="time"
            value={row.endTime}
            onChange={(e) => onChange({ ...row, endTime: e.target.value })}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
          />
        </label>
        <label className="flex items-center gap-1.5 text-zinc-600">
          Room
          <input
            type="text"
            value={row.room ?? ""}
            onChange={(e) => onChange({ ...row, room: e.target.value || null })}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
            placeholder="Room (optional)"
          />
        </label>
      </div>

      <DayPicker
        value={row.daysOfWeek as Day[]}
        onChange={(days) => onChange({ ...row, daysOfWeek: days })}
      />
    </div>
  );
}