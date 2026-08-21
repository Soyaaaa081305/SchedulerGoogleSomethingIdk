import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError } from "@/lib/api";
import { deleteWeeklyEvent } from "@/lib/calendar";

export async function DELETE() {
  try {
    const userId = await requireUser();
    const schedules = await prisma.schedule.findMany({
      where: { userId },
      select: { id: true, googleEventId: true },
    });

    for (const s of schedules) {
      if (s.googleEventId) {
        await deleteWeeklyEvent(userId, s.googleEventId).catch(() => {});
      }
    }

    await prisma.schedule.deleteMany({ where: { userId } });

    return NextResponse.json({ ok: true, deleted: schedules.length });
  } catch (err) {
    return handleError(err);
  }
}
