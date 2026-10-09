import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { createWeeklyEvent, updateWeeklyEvent } from "@/lib/calendar";
import { getOrCreateSettings } from "@/lib/reminder";
import type { Day } from "@/lib/days";

interface SyncRow {
  id: string;
  courseName: string;
  daysOfWeek: string;
  startTime: string;
  endTime: string;
  room: string | null;
  googleEventId?: string | null;
}

interface SyncResult {
  scheduleId: string;
  status: "created" | "repaired" | "failed";
  googleEventId: string | null;
  error?: string;
}

const SYNC_CONCURRENCY = 3;

export async function POST() {
  try {
    const userId = await requireUser();
    const settings = await getOrCreateSettings(userId);

    // Two kinds of backlog:
    //  1. never synced   -> no googleEventId yet          -> create
    //  2. failed re-sync -> googleEventId set, no marker  -> push the edit up
    const [unsynced, stale] = await Promise.all([
      prisma.schedule.findMany({ where: { userId, googleEventId: null } }),
      prisma.schedule.findMany({
        where: { userId, googleEventId: { not: null }, lastSyncedAt: null },
      }),
    ]);
    const backlog = [...unsynced, ...stale];

    const syncRow = async (row: SyncRow): Promise<SyncResult> => {
      const input = {
        scheduleId: row.id,
        courseName: row.courseName,
        daysOfWeek: row.daysOfWeek.split(",").filter(Boolean) as Day[],
        startTime: row.startTime,
        endTime: row.endTime,
        room: row.room,
        timezone: settings.timezone,
        semesterEnd: settings.semesterEnd?.toISOString(),
      };
      try {
        if (row.googleEventId) {
          const updated = await updateWeeklyEvent(userId, row.googleEventId, input);
          if (!updated) {
            return {
              scheduleId: row.id,
              status: "failed",
              googleEventId: row.googleEventId,
              error: "Google Calendar is not connected.",
            };
          }
          await prisma.schedule.update({
            where: { id: row.id },
            data: { lastSyncedAt: new Date() },
          });
          return { scheduleId: row.id, status: "repaired", googleEventId: row.googleEventId };
        } else {
          const event = await createWeeklyEvent(userId, input);
          if (!event) {
            return {
              scheduleId: row.id,
              status: "failed",
              googleEventId: null,
              error: "Google Calendar is not connected.",
            };
          }
          await prisma.schedule.update({
            where: { id: row.id },
            data: { googleEventId: event.id, lastSyncedAt: new Date() },
          });
          return { scheduleId: row.id, status: "created", googleEventId: event.id };
        }
      } catch (err) {
        const error =
          err instanceof ApiError
            ? err.message
            : "Calendar sync failed for this class. Try again in Settings.";
        console.error("[sync] class failed", { scheduleId: row.id, error });
        return {
          scheduleId: row.id,
          status: "failed",
          googleEventId: row.googleEventId ?? null,
          error,
        };
      }
    };

    const results: SyncResult[] = new Array(backlog.length);
    let nextIndex = 0;
    const worker = async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= backlog.length) return;
        results[index] = await syncRow(backlog[index]);
      }
    };
    const workerCount = Math.min(SYNC_CONCURRENCY, backlog.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    const created = results.filter((result) => result.status === "created").length;
    const repaired = results.filter((result) => result.status === "repaired").length;
    const failed = results.filter((result) => result.status === "failed").length;
    const firstError = results.find((result) => result.error)?.error ?? null;

    return NextResponse.json({ ok: true, created, repaired, failed, firstError, results });
  } catch (err) {
    return handleError(err);
  }
}
