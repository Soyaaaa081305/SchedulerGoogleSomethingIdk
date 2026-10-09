import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleError, requireUser } from "@/lib/api";
import { createSchedulesForUser } from "@/lib/scheduleService";

const batchRequestSchema = z.object({
  schedules: z.array(z.unknown()).min(1).max(100),
});

export async function POST(req: Request) {
  try {
    const userId = await requireUser();
    const body = await req.json().catch(() => null);
    const parsed = batchRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Add between 1 and 100 valid classes.");
    }

    const schedules = await createSchedulesForUser(userId, parsed.data.schedules);
    return NextResponse.json({ schedules }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
