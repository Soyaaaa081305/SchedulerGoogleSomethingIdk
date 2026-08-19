import { prisma } from "@/lib/prisma";
import { formatTime12h, weekdayInTz } from "@/lib/days";

export interface ReminderMessage {
  title: string;
  body: string;
  hasContent: boolean;
}

export async function buildReminderMessage(userId: string, timezone: string): Promise<ReminderMessage> {
  const weekday = weekdayInTz(timezone);

  const schedules = await prisma.schedule.findMany({ where: { userId } });
  const todaysClasses = schedules.filter((s) =>
    s.daysOfWeek.split(",").includes(weekday ?? "")
  );

  const lines: string[] = [];

  if (todaysClasses.length > 0) {
    lines.push(`Classes today (${weekday ?? ""}):`);
    for (const c of todaysClasses) {
      const room = c.room ? `, ${c.room}` : "";
      lines.push(`- ${c.courseName}: ${formatTime12h(c.startTime)}-${formatTime12h(c.endTime)}${room}`);
    }
  }

  if (lines.length === 0) {
    return {
      title: "Scheduler - daily check-in",
      body: "No classes today. You're all set. Good night!",
      hasContent: false,
    };
  }

  return {
    title: "Scheduler - check today's classes!",
    body: lines.join("\n"),
    hasContent: true,
  };
}

export async function getOrCreateSettings(userId: string) {
  return prisma.settings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}