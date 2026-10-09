import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { toScheduleDTO } from "@/lib/types";
import { prepareScheduleBatch } from "@/lib/scheduleBatch";

export async function createSchedulesForUser(userId: string, inputs: unknown) {
  const existing = await prisma.schedule.findMany({
    where: { userId },
    select: { id: true, courseName: true, daysOfWeek: true, startTime: true, endTime: true },
  });
  const prepared = prepareScheduleBatch(inputs, existing);
  if (!prepared.ok) throw new ApiError(prepared.status, prepared.error);

  const created = await prisma.$transaction(
    prepared.schedules.map((schedule) =>
      prisma.schedule.create({
        data: {
          userId,
          courseName: schedule.courseName,
          daysOfWeek: schedule.daysOfWeek.join(","),
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          room: schedule.room,
        },
      })
    )
  );

  return created.map(toScheduleDTO);
}
