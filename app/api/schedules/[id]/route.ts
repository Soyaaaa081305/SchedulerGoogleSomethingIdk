import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { scheduleUpdateSchema, normalizeSchedule, findOverlap } from "@/lib/validators";
import { createWeeklyEvent, deleteWeeklyEvent, updateWeeklyEvent } from "@/lib/calendar";
import { getOrCreateSettings } from "@/lib/reminder";
import { toScheduleDTO } from "@/lib/types";

async function getOwnedSchedule(id: string, userId: string) {
  const schedule = await prisma.schedule.findFirst({ where: { id, userId } });
  if (!schedule) throw new ApiError(404, "Schedule not found");
  return schedule;
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/schedules/[id]">) {
  try {
    const userId = await requireUser();
    const { id } = await ctx.params;
    const schedule = await getOwnedSchedule(id, userId);

    const body = await req.json();
    const parsed = scheduleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid schedule data: " + parsed.error.issues[0]?.message);
    }

    const merged = {
      courseName: parsed.data.courseName ?? schedule.courseName,
      daysOfWeek: parsed.data.daysOfWeek ?? schedule.daysOfWeek.split(","),
      startTime: parsed.data.startTime ?? schedule.startTime,
      endTime: parsed.data.endTime ?? schedule.endTime,
      room: parsed.data.room ?? schedule.room,
    };
    const normalized = normalizeSchedule(merged);
    if (!normalized.ok) throw new ApiError(400, normalized.error);

    const existing = await prisma.schedule.findMany({
      where: { userId },
      select: { id: true, courseName: true, daysOfWeek: true, startTime: true, endTime: true },
    });
    const conflict = findOverlap(existing, {
      id: schedule.id,
      courseName: normalized.data.courseName,
      daysOfWeek: normalized.data.daysOfWeek,
      startTime: normalized.data.startTime,
      endTime: normalized.data.endTime,
    });
    if (conflict) {
      throw new ApiError(
        409,
        `"${normalized.data.courseName}" overlaps with "${conflict.courseName}" on ${conflict.day} (${conflict.startTime}–${conflict.endTime}). Please fix the time first.`
      );
    }

    const settings = await getOrCreateSettings(userId);
    const eventInput = {
      courseName: normalized.data.courseName,
      daysOfWeek: normalized.data.daysOfWeek,
      startTime: normalized.data.startTime,
      endTime: normalized.data.endTime,
      room: normalized.data.room,
      timezone: settings.timezone,
      semesterEnd: settings.semesterEnd?.toISOString(),
    };

    let googleEventId = schedule.googleEventId;
    let lastSyncedAt = schedule.lastSyncedAt;

    try {
      if (schedule.googleEventId) {
        const ok = await updateWeeklyEvent(userId, schedule.googleEventId, eventInput);
        lastSyncedAt = ok ? new Date() : null;
      } else {
        const event = await createWeeklyEvent(userId, eventInput);
        if (event) {
          googleEventId = event.id;
          lastSyncedAt = new Date();
        }
      }
    } catch (err) {
      console.error("[schedules] google sync failed on update:", err);
      // Keep the event id (it still exists remotely) but drop the sync marker
      // so the row honestly shows "unsynced" after a failed re-sync.
      lastSyncedAt = null;
    }

    const updated = await prisma.schedule.update({
      where: { id },
      data: {
        courseName: normalized.data.courseName,
        daysOfWeek: normalized.data.daysOfWeek.join(","),
        startTime: normalized.data.startTime,
        endTime: normalized.data.endTime,
        room: normalized.data.room,
        googleEventId,
        // Write null explicitly (undefined would skip the field and keep a
        // stale "synced" marker after a failed re-sync).
        lastSyncedAt,
      },
    });

    return NextResponse.json({ schedule: toScheduleDTO(updated) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/schedules/[id]">) {
  try {
    const userId = await requireUser();
    const { id } = await ctx.params;
    const schedule = await getOwnedSchedule(id, userId);

    if (schedule.googleEventId) {
      const result = await deleteWeeklyEvent(userId, schedule.googleEventId)
        .then(() => true)
        .catch((err) => {
          console.warn("[schedules] google event delete failed for", schedule.courseName, err);
          return false;
        });
      if (!result) {
        console.warn(
          "[schedules] calendar row removed locally but Google event",
          schedule.googleEventId,
          "was not deleted (calendar unreachable or not connected)."
        );
      }
    }

    await prisma.schedule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}