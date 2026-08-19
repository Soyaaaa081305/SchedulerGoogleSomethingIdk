import { z } from "zod";
import { normalizeDay, normalizeTime, type Day } from "@/lib/days";

export const scheduleCreateSchema = z.object({
  courseName: z.string().trim().min(1).max(200),
  daysOfWeek: z.array(z.string()).min(1).max(7),
  startTime: z.string(),
  endTime: z.string(),
  room: z.string().trim().max(200).nullable().optional(),
  semesterEnd: z.string().optional(),
});

export const scheduleUpdateSchema = scheduleCreateSchema.partial();

export function normalizeSchedule(
  input: z.infer<typeof scheduleCreateSchema>
): { ok: true; data: { courseName: string; daysOfWeek: Day[]; startTime: string; endTime: string; room: string | null; semesterEnd?: string } } | { ok: false; error: string } {
  const days: Day[] = [];
  for (const raw of input.daysOfWeek) {
    const day = normalizeDay(raw);
    if (day && !days.includes(day)) days.push(day);
  }
  if (days.length === 0) return { ok: false, error: "At least one valid day is required (e.g. MON, TUE, WED)" };

  const startTime = normalizeTime(input.startTime);
  const endTime = normalizeTime(input.endTime);
  if (!startTime) return { ok: false, error: `Invalid start time: ${input.startTime}` };
  if (!endTime) return { ok: false, error: `Invalid end time: ${input.endTime}` };
  if (endTime <= startTime) return { ok: false, error: "End time must be after start time" };

  return {
    ok: true,
    data: {
      courseName: input.courseName,
      daysOfWeek: days,
      startTime,
      endTime,
      room: input.room?.trim() || null,
      semesterEnd: input.semesterEnd,
    },
  };
}

export interface OverlapCandidate {
  id?: string;
  courseName: string;
  daysOfWeek: Day[];
  startTime: string;
  endTime: string;
}

export function findOverlap(
  existing: Array<{ id?: string; courseName: string; daysOfWeek: string; startTime: string; endTime: string }>,
  candidate: OverlapCandidate
): { courseName: string; day: string; startTime: string; endTime: string } | null {
  for (const e of existing) {
    if (e.id && e.id === candidate.id) continue;
    const sharedDays = e.daysOfWeek
      .split(",")
      .filter((d): d is Day => candidate.daysOfWeek.includes(d as Day));
    if (sharedDays.length === 0) continue;
    const overlaps = candidate.startTime < e.endTime && candidate.endTime > e.startTime;
    if (overlaps) {
      return {
        courseName: e.courseName,
        day: sharedDays[0],
        startTime: e.startTime,
        endTime: e.endTime,
      };
    }
  }
  return null;
}

export const settingsPatchSchema = z
  .object({
    reminderEnabled: z.boolean().optional(),
    reminderTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time")
      .optional(),
    timezone: z.string().min(1).optional(),
    semesterEnd: z
      .string()
      .datetime({ offset: true })
      .nullable()
      .optional(),
  })
  .strict();

export const extractSchema = z.object({
  text: z.string().min(3).max(100000),
});

export const pushSubscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});