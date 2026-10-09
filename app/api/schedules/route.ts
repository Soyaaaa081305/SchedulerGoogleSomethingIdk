import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { toScheduleDTO } from "@/lib/types";
import { createSchedulesForUser } from "@/lib/scheduleService";

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
    const body = await req.json().catch(() => null);
    if (!body) throw new ApiError(400, "Invalid JSON body");
    const [schedule] = await createSchedulesForUser(userId, [body]);
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
