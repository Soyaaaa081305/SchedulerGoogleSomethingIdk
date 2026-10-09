import { findOverlap, normalizeSchedule, scheduleCreateSchema } from "@/lib/validators";
import type { Day } from "@/lib/days";

export interface ExistingSchedule {
  id?: string;
  courseName: string;
  daysOfWeek: string;
  startTime: string;
  endTime: string;
}

export interface PreparedSchedule {
  courseName: string;
  daysOfWeek: Day[];
  startTime: string;
  endTime: string;
  room: string | null;
}

export type ScheduleBatchResult =
  | { ok: true; schedules: PreparedSchedule[] }
  | { ok: false; status: 400 | 409; error: string };

const MAX_BATCH_SIZE = 100;

function overlapMessage(
  name: string,
  conflict: { courseName: string; day: string; startTime: string; endTime: string }
) {
  return `"${name}" overlaps with "${conflict.courseName}" on ${conflict.day} (${conflict.startTime}–${conflict.endTime}). Please fix the time first.`;
}

export function prepareScheduleBatch(
  inputs: unknown,
  existing: ExistingSchedule[]
): ScheduleBatchResult {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return { ok: false, status: 400, error: "Add at least one class." };
  }
  if (inputs.length > MAX_BATCH_SIZE) {
    return { ok: false, status: 400, error: `A batch can contain at most ${MAX_BATCH_SIZE} classes.` };
  }

  const schedules: PreparedSchedule[] = [];
  const occupied = [...existing];

  for (const input of inputs) {
    const parsed = scheduleCreateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        error: `Invalid schedule data: ${parsed.error.issues[0]?.message ?? "Check the class details."}`,
      };
    }

    const normalized = normalizeSchedule(parsed.data);
    if (!normalized.ok) return { ok: false, status: 400, error: normalized.error };

    const candidate = {
      courseName: normalized.data.courseName,
      daysOfWeek: normalized.data.daysOfWeek,
      startTime: normalized.data.startTime,
      endTime: normalized.data.endTime,
    };
    const conflict = findOverlap(occupied, candidate);
    if (conflict) {
      return {
        ok: false,
        status: 409,
        error: overlapMessage(candidate.courseName, conflict),
      };
    }

    const schedule: PreparedSchedule = {
      ...candidate,
      room: normalized.data.room,
    };
    schedules.push(schedule);
    occupied.push({
      courseName: schedule.courseName,
      daysOfWeek: schedule.daysOfWeek.join(","),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    });
  }

  return { ok: true, schedules };
}
