import { NextResponse } from "next/server";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { settingsPatchSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

function toDTO(s: {
  reminderEnabled: boolean;
  reminderTime: string;
  timezone: string;
  semesterEnd: Date | null;
}) {
  return {
    reminderEnabled: s.reminderEnabled,
    reminderTime: s.reminderTime,
    timezone: s.timezone,
    semesterEnd: s.semesterEnd ? s.semesterEnd.toISOString() : null,
  };
}

export async function GET() {
  try {
    const userId = await requireUser();
    let settings = await prisma.settings.findUnique({ where: { userId } });
    if (!settings) {
      settings = await prisma.settings.create({ data: { userId } });
    }
    return NextResponse.json({ settings: toDTO(settings) });
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

    const data: Record<string, unknown> = { ...parsed.data };
    if ("semesterEnd" in data) {
      data.semesterEnd = data.semesterEnd ? new Date(data.semesterEnd as string) : null;
    }

    const settings = await prisma.settings.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    return NextResponse.json({ settings: toDTO(settings) });
  } catch (err) {
    return handleError(err);
  }
}