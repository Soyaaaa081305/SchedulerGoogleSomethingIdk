import type { ParsedCourse } from "@/lib/gemini";
import type { ScheduleDTO } from "@/lib/types";

interface ApiErrorBody {
  error?: string;
}

export interface ScheduleSyncResult {
  scheduleId: string;
  status: "created" | "repaired" | "failed";
  googleEventId: string | null;
  error?: string;
}

export interface ScheduleSyncSummary extends ApiErrorBody {
  ok: boolean;
  created: number;
  repaired: number;
  failed: number;
  firstError: string | null;
  results: ScheduleSyncResult[];
}

async function requestJson<T extends object>(
  url: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => null)) as (T & ApiErrorBody) | null;
  if (!response.ok) throw new Error(data?.error ?? fallbackMessage);
  if (!data) throw new Error(fallbackMessage);
  return data;
}

export async function saveSchedule(input: ParsedCourse): Promise<ScheduleDTO> {
  const data = await requestJson<{ schedule?: ScheduleDTO }>(
    "/api/schedules",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
    "Could not save the class"
  );
  if (!data.schedule) throw new Error("The saved class could not be loaded");
  return data.schedule;
}

export async function saveSchedules(inputs: ParsedCourse[]): Promise<ScheduleDTO[]> {
  const data = await requestJson<{ schedules?: ScheduleDTO[] }>(
    "/api/schedules/batch",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedules: inputs }),
    },
    "Could not save the classes"
  );
  if (!data.schedules) throw new Error("The saved classes could not be loaded");
  return data.schedules;
}

export function syncScheduleBacklog(): Promise<ScheduleSyncSummary> {
  return requestJson<ScheduleSyncSummary>(
    "/api/schedules/sync",
    { method: "POST" },
    "Could not sync classes"
  );
}

export async function loadSchedules(): Promise<ScheduleDTO[]> {
  const data = await requestJson<{ schedules?: ScheduleDTO[] }>(
    "/api/schedules",
    { method: "GET" },
    "Could not refresh your schedule"
  );
  if (!data.schedules) throw new Error("Your schedule could not be refreshed");
  return data.schedules;
}
