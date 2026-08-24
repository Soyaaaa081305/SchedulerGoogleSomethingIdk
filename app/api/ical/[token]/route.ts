import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { schedulesToICS } from "@/lib/ics";
import { verifyIcalToken } from "@/lib/icalToken";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const userId = verifyIcalToken(token);
    if (!userId) return new NextResponse("Invalid calendar link", { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return new NextResponse("Not found", { status: 404 });

    const [schedules, settings] = await Promise.all([
      prisma.schedule.findMany({ where: { userId } }),
      prisma.settings.findUnique({ where: { userId } }),
    ]);

    const ics = schedulesToICS(
      schedules.map((s) => ({
        id: s.id,
        courseName: s.courseName,
        daysOfWeek: s.daysOfWeek ? s.daysOfWeek.split(",").filter(Boolean) : [],
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
      })),
      { timezone: settings?.timezone ?? "Asia/Manila", semesterEnd: settings?.semesterEnd?.toISOString() ?? null }
    );

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="schedule.ics"',
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    logger.error("[ical] failed", { error: String(err) });
    return new NextResponse("Could not generate calendar", { status: 500 });
  }
}
