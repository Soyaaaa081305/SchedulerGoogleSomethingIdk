import { prisma } from "@/lib/prisma";
import { formatTime12h, tomorrowWeekdayInTz } from "@/lib/days";

export interface ReminderMessage {
  title: string;
  body: string;
  hasContent: boolean;
}

/**
 * Builds the nightly reminder body. The push goes out in the evening, so it
 * previews TOMORROW's classes — matching what the UI promises.
 */
export async function buildReminderMessage(userId: string, timezone: string): Promise<ReminderMessage> {
  const weekday = tomorrowWeekdayInTz(timezone);

  const schedules = await prisma.schedule.findMany({ where: { userId } });
  const tomorrowsClasses =
    weekday === null
      ? []
      : schedules
          .filter((s) => s.daysOfWeek.split(",").includes(weekday))
          .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const lines: string[] = [];

  if (tomorrowsClasses.length > 0 && weekday) {
    lines.push(`Classes tomorrow (${weekday}):`);
    for (const c of tomorrowsClasses) {
      const room = c.room ? `, ${c.room}` : "";
      lines.push(`- ${c.courseName}: ${formatTime12h(c.startTime)}-${formatTime12h(c.endTime)}${room}`);
    }
  }

  if (lines.length === 0) {
    return {
      title: "Scheduler - daily check-in",
      body: "No classes tomorrow. You're all set. Good night!",
      hasContent: false,
    };
  }

  return {
    title: "Scheduler - tomorrow's classes",
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
