import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUser();
    const [user, schedules, settings, pushSubs] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, image: true } }),
      prisma.schedule.findMany({ where: { userId } }),
      prisma.settings.findUnique({ where: { userId } }),
      prisma.pushSubscription.findMany({ where: { userId }, select: { endpoint: true, createdAt: true } }),
    ]);
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      user,
      schedules: schedules.map((s) => ({
        ...s,
        daysOfWeek: s.daysOfWeek,
      })),
      settings,
      pushSubscriptions: pushSubs.length,
    });
  } catch (err) {
    return handleError(err);
  }
}
