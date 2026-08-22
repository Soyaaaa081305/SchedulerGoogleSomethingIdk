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

    const withEvents = schedules.filter((s) => s.googleEventId);

    const results = await Promise.allSettled(
      withEvents.map((s) => deleteWeeklyEvent(userId, s.googleEventId!))
    );
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.warn("[schedules] google event delete failed for", withEvents[i].id, r.reason);
      }
    });

    await prisma.schedule.deleteMany({ where: { userId } });

    return NextResponse.json({
      ok: true,
      deleted: schedules.length,
      calendarDeletesFailed: results.filter((r) => r.status === "rejected").length,
    });
  } catch (err) {
    return handleError(err);
  }
}
