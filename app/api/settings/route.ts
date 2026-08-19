import { NextResponse } from "next/server";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { settingsPatchSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const userId = await requireUser();
    let settings = await prisma.settings.findUnique({ where: { userId } });
    if (!settings) {
      settings = await prisma.settings.create({ data: { userId } });
    }
    return NextResponse.json({
      settings: {
        reminderEnabled: settings.reminderEnabled,
        reminderTime: settings.reminderTime,
        timezone: settings.timezone,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await requireUser();
    const body = await req.json();
    const parsed = settingsPatchSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Invalid settings data");

    const settings = await prisma.settings.upsert({
      where: { userId },
      update: parsed.data,
      create: { userId, ...parsed.data },
    });

    return NextResponse.json({
      settings: {
        reminderEnabled: settings.reminderEnabled,
        reminderTime: settings.reminderTime,
        timezone: settings.timezone,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}