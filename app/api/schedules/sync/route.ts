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

    let created = 0;
    let repaired = 0;
    let failed = 0;
    let firstError: string | null = null;

    const syncRow = async (row: SyncRow) => {
      const input = {
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
          await updateWeeklyEvent(userId, row.googleEventId, input);
          await prisma.schedule.update({
            where: { id: row.id },
            data: { lastSyncedAt: new Date() },
          });
          repaired++;
        } else {
          const event = await createWeeklyEvent(userId, input);
          if (!event) {
            failed++;
            firstError ??= "Google Calendar is not connected.";
            return;
          }
          await prisma.schedule.update({
            where: { id: row.id },
            data: { googleEventId: event.id, lastSyncedAt: new Date() },
          });
          created++;
        }
      } catch (err) {
        failed++;
        firstError ??=
          err instanceof ApiError ? err.message : "Sync failed for one or more classes.";
        console.error("[sync] failed for", row.courseName, err);
      }
    };

    for (const s of unsynced) await syncRow(s);
    for (const s of stale) await syncRow(s);

    return NextResponse.json({ ok: true, created, repaired, failed, firstError });
  } catch (err) {
    return handleError(err);
  }
}
