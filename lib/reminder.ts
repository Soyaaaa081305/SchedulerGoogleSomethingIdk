import { prisma } from "@/lib/prisma";
import { formatTime12h, todayInTz, toYmd, weekdayInTz } from "@/lib/days";

export interface ReminderMessage {
  title: string;
  body: string;
  hasContent: boolean;
}

export async function buildReminderMessage(userId: string, timezone: string): Promise<ReminderMessage> {
  const today = todayInTz(timezone);
  const weekday = weekdayInTz(timezone);

  const schedules = await prisma.schedule.findMany({ where: { userId } });
  const todaysClasses = schedules.filter((s) =>
    s.daysOfWeek.split(",").includes(weekday ?? "")
  );

  const tasks = await prisma.task.findMany({
    where: { userId, completed: false },
    orderBy: { dueDate: "asc" },
  });
  const dueToday = tasks.filter((t) => t.dueDate && toYmd(t.dueDate, timezone) === today);
  const overdue = tasks.filter((t) => t.dueDate && toYmd(t.dueDate, timezone) < today);
  const upcoming = tasks.filter((t) => t.dueDate && toYmd(t.dueDate, timezone) > today);

  const lines: string[] = [];

  if (todaysClasses.length > 0) {
    lines.push(`Classes today (${weekday ?? ""}):`);
    for (const c of todaysClasses) {
      const room = c.room ? `, ${c.room}` : "";
      lines.push(`- ${c.courseName}: ${formatTime12h(c.startTime)}-${formatTime12h(c.endTime)}${room}`);
    }
  }

  if (dueToday.length > 0) {
    lines.push(dueToday.length === 1 ? "Due today:" : `Due today (${dueToday.length}):`);
    for (const t of dueToday) lines.push(`- ${t.title}`);
  }

  if (overdue.length > 0) {
    lines.push(`Overdue: ${overdue.length} task${overdue.length > 1 ? "s" : ""} (${overdue.map((t) => t.title).join(", ")})`);
  }

  if (upcoming.length > 0) {
    const soon = upcoming.slice(0, 3);
    lines.push("Coming up:");
    for (const t of soon) lines.push(`- ${t.title} (${toYmd(t.dueDate!, timezone)})`);
  }

  if (lines.length === 0) {
    return {
      title: "Scheduler - daily check-in",
      body: "No classes or due tasks for today. You're all set. Good night!",
      hasContent: false,
    };
  }

  return {
    title: "Scheduler - double-check your things!",
    body: lines.join("\n"),
    hasContent: true,
  };
}

export async function getOrCreateSettings(userId: string) {
  const existing = await prisma.settings.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.settings.create({
    data: { userId },
  });
}