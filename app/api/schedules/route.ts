import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { scheduleCreateSchema, normalizeSchedule, findOverlap } from "@/lib/validators";
import { createWeeklyEvent } from "@/lib/calendar";
import { getOrCreateSettings } from "@/lib/reminder";
import { toScheduleDTO } from "@/lib/types";

function overlapMessage(
  name: string,
  conflict: { courseName: string; day: string; startTime: string; endTime: string }
): string {
  return `"${name}" overlaps with "${conflict.courseName}" on ${conflict.day} (${conflict.startTime}–${conflict.endTime}). Please fix the time first.`;
}

export async function GET() {
  try {
    const userId = await requireUser();
    const schedules = await prisma.schedule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ schedules: schedules.map(toScheduleDTO) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUser();
    const body = await req.json();
    const parsed = scheduleCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid schedule data: " + parsed.error.issues[0]?.message);
    }

    const normalized = normalizeSchedule(parsed.data);
    if (!normalized.ok) throw new ApiError(400, normalized.error);

    const existing = await prisma.schedule.findMany({
      where: { userId },
      select: { id: true, courseName: true, daysOfWeek: true, startTime: true, endTime: true },
    });
    const conflict = findOverlap(existing, {
      courseName: normalized.data.courseName,
      daysOfWeek: normalized.data.daysOfWeek,
      startTime: normalized.data.startTime,
      endTime: normalized.data.endTime,
    });
    if (conflict) {
      throw new ApiError(409, overlapMessage(normalized.data.courseName, conflict));
    }

    const settings = await getOrCreateSettings(userId);
    const event = await createWeeklyEvent(userId, {
      courseName: normalized.data.courseName,
      daysOfWeek: normalized.data.daysOfWeek,
      startTime: normalized.data.startTime,
      endTime: normalized.data.endTime,
      room: normalized.data.room,
      timezone: settings.timezone,
      semesterEnd: normalized.data.semesterEnd,
    });

    if (!event) {
      throw new ApiError(403, "Connect your Google Calendar first to add classes to your calendar.");
    }

    const schedule = await prisma.schedule.create({
      data: {
        userId,
        courseName: normalized.data.courseName,
        daysOfWeek: normalized.data.daysOfWeek.join(","),
        startTime: normalized.data.startTime,
        endTime: normalized.data.endTime,
        room: normalized.data.room,
        googleEventId: event.id,
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({ schedule: toScheduleDTO(schedule) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}