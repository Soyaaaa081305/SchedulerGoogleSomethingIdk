import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { createWeeklyEvent } from "@/lib/calendar";
import { getOrCreateSettings } from "@/lib/reminder";
import type { Day } from "@/lib/days";

export async function POST() {
  try {
    const userId = await requireUser();
    const settings = await getOrCreateSettings(userId);
    const unsynced = await prisma.schedule.findMany({
      where: { userId, googleEventId: null },
    });
    let created = 0;
    let failed = 0;
    let firstError: string | null = null;

    for (const s of unsynced) {
      try {
        const event = await createWeeklyEvent(userId, {
          courseName: s.courseName,
          daysOfWeek: s.daysOfWeek.split(",") as Day[],
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room,
          timezone: settings.timezone,
          semesterEnd: settings.semesterEnd?.toISOString(),
        });
        if (!event) {
          failed++;
          firstError ??= "Google Calendar is not connected.";
          continue;
        }
        await prisma.schedule.update({
          where: { id: s.id },
          data: { googleEventId: event.id, lastSyncedAt: new Date() },
        });
        created++;
      } catch (err) {
        failed++;
        if (err instanceof ApiError) {
          firstError ??= err.message;
        } else {
          firstError ??= "Sync failed for one or more classes.";
        }
        console.error("[sync] failed for", s.courseName, err);
      }
    }

    return NextResponse.json({ ok: true, created, failed, firstError });
  } catch (err) {
    return handleError(err);
  }
}
