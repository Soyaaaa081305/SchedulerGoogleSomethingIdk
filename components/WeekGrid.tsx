"use client";

import { useMemo } from "react";
import { DAYS, formatTime12h, type Day } from "@/lib/days";
import type { ScheduleDTO } from "@/lib/types";

const HOUR_HEIGHT = 56; // px per hour
const MIN_BLOCK = 20; // px minimum block height

interface PlacedBlock {
  schedule: ScheduleDTO;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Assigns overlapping classes on the same day side-by-side "lanes".
 * Simple greedy algorithm: cluster events that overlap transitively,
 * then assign each to the first free lane inside its cluster.
 */
function layoutDay(items: ScheduleDTO[]): PlacedBlock[] {
  const parsed = items
    .map((s) => ({ s, start: toMinutes(s.startTime), end: toMinutes(s.endTime) }))
    .filter((x) => x.end > x.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const blocks: PlacedBlock[] = [];
  let cluster: typeof parsed = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    for (const item of cluster) {
      let lane = laneEnds.findIndex((end) => end <= item.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(item.end);
      } else {
        laneEnds[lane] = item.end;
      }
      blocks.push({
        schedule: item.s,
        top: (item.start / 60) * HOUR_HEIGHT,
        height: Math.max(MIN_BLOCK, ((item.end - item.start) / 60) * HOUR_HEIGHT - 2),
        lane,
        lanes: laneEnds.length,
      });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of parsed) {
    if (cluster.length > 0 && item.start >= clusterEnd) {
      flush();
    }
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();

  return blocks;
}

export default function WeekGrid({
  schedules,
  timezone,
  today,
}: {
  schedules: ScheduleDTO[];
  timezone: string;
  /** Client-side only: today's day code, used to highlight the column. */
  today?: Day | null;
}) {

  const model = useMemo(() => {
    const used = new Set<string>();
    for (const s of schedules) for (const d of s.daysOfWeek) used.add(d);

    // Always show MON–FRI; add SAT/SUN only when a class meets then.
    const columns = DAYS.filter((d) => (d <= "FRI" ? true : used.has(d)));

    let axisStartMin = 7 * 60;
    let axisEndMin = 19 * 60;
    for (const s of schedules) {
      const start = toMinutes(s.startTime);
      const end = toMinutes(s.endTime);
      if (!Number.isNaN(start)) axisStartMin = Math.min(axisStartMin, start);
      if (!Number.isNaN(end)) axisEndMin = Math.max(axisEndMin, end);
    }
    // Snap to whole hours with breathing room.
    axisStartMin = Math.floor(axisStartMin / 60) * 60;
    axisEndMin = Math.ceil(axisEndMin / 60) * 60;
    const hoursCount = Math.max(1, (axisEndMin - axisStartMin) / 60);

    const byDay = new Map<string, ScheduleDTO[]>();
    for (const col of columns) {
      byDay.set(
        col,
        schedules.filter((s) => s.daysOfWeek.includes(col))
      );
    }

    return { columns, axisStartMin, hoursCount, byDay };
  }, [schedules]);

  const gridHeight = model.hoursCount * HOUR_HEIGHT;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Header row */}
        <div
          className="grid border-b border-zinc-200 pb-2"
          style={{ gridTemplateColumns: `3.5rem repeat(${model.columns.length}, minmax(0, 1fr))` }}
        >
          <div />
          {model.columns.map((day) => (
            <div
              key={day}
              className={`text-center text-xs font-semibold ${
                day === today ? "text-[#c8102e]" : "text-zinc-500"
              }`}
            >
              {day}
              {day === today && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#c8102e]" aria-hidden="true" />}
            </div>
          ))}
        </div>

        <div className="relative flex">
          {/* Hour labels */}
          <div className="w-14 shrink-0" style={{ height: gridHeight }}>
            {Array.from({ length: model.hoursCount + 1 }).map((_, i) => (
              <div
                key={i}
                className="relative text-[10px] font-medium text-zinc-400"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-1.5 right-1">
                  {formatTime12h(`${String((model.axisStartMin / 60 + i) % 24).padStart(2, "0")}:00`)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {model.columns.map((day) => {
            const blocks = layoutDay(model.byDay.get(day) ?? []);
            return (
              <div
                key={day}
                className={`relative flex-1 border-l border-zinc-100 ${
                  day === today ? "bg-[#fdeeef]/40" : ""
                }`}
                style={{ height: gridHeight }}
              >
                {Array.from({ length: model.hoursCount }).map((_, i) => (
                  <div
                    key={i}
                    className="border-b border-zinc-100"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}
                {blocks.map((b, i) => (
                  <div
                    key={`${b.schedule.id}-${i}`}
                    title={`${b.schedule.courseName} · ${formatTime12h(b.schedule.startTime)}–${formatTime12h(b.schedule.endTime)}${b.schedule.room ? ` · ${b.schedule.room}` : ""}`}
                    className="absolute overflow-hidden rounded-md border-l-[3px] border-[#c8102e] bg-[#fdeeef] px-1.5 py-0.5 shadow-sm"
                    style={{
                      top: b.top,
                      height: b.height,
                      left: `${(b.lane / b.lanes) * 100}%`,
                      width: `calc(${(1 / b.lanes) * 100}% - 4px)`,
                    }}
                  >
                    <p className="truncate text-[11px] font-semibold leading-tight text-[#8a0a1e]">
                      {b.schedule.courseName}
                    </p>
                    {b.height > 34 && (
                      <p className="truncate text-[10px] leading-tight text-[#a8596a]">
                        {formatTime12h(b.schedule.startTime)}
                        {b.schedule.room ? ` · ${b.schedule.room}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-400">Times shown in {timezone}.</p>
    </div>
  );
}
