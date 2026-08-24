import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError } from "@/lib/api";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function DELETE() {
  try {
    const userId = await requireUser();
    const [schedules, pushSubs, settings] = await Promise.all([
      prisma.schedule.deleteMany({ where: { userId } }),
      prisma.pushSubscription.deleteMany({ where: { userId } }),
      prisma.settings.deleteMany({ where: { userId } }),
    ]);
    logger.info("[gdpr] user data deleted", { userId, schedules: schedules.count, pushSubs: pushSubs.count });
    return NextResponse.json({ ok: true, deleted: { schedules: schedules.count, pushSubs: pushSubs.count, settings: settings.count } });
  } catch (err) {
    return handleError(err);
  }
}
