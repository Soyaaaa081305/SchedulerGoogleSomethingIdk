import { auth } from "@/auth";
import SignIn from "@/components/SignIn";
import Dashboard, { type InitialData } from "@/components/Dashboard";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings } from "@/lib/reminder";
import { getCalendarStatus } from "@/lib/api";
import { toScheduleDTO } from "@/lib/types";
import { todayInTz, toYmd, weekdayInTz } from "@/lib/days";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    return <SignIn />;
  }

  const userId = session.user.id;
  const settings = await getOrCreateSettings(userId);
  const timezone = settings.timezone;

  const [schedules, tasks, cal] = await Promise.all([
    prisma.schedule.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.task.findMany({ where: { userId }, orderBy: { dueDate: "asc" } }),
    getCalendarStatus(userId),
  ]);

  const weekday = weekdayInTz(timezone);
  const today = todayInTz(timezone);
  const classesToday = schedules
    .filter((s) => s.daysOfWeek.split(",").includes(weekday ?? ""))
    .map((s) => s.courseName);
  const tasksDueToday = tasks.filter(
    (t) => !t.completed && t.dueDate && toYmd(t.dueDate, timezone) === today
  ).length;
  const overdueTasks = tasks.filter(
    (t) => !t.completed && t.dueDate && toYmd(t.dueDate, timezone) < today
  ).length;

  const initial: InitialData = {
    schedules: schedules.map(toScheduleDTO),
    settings: {
      reminderEnabled: settings.reminderEnabled,
      reminderTime: settings.reminderTime,
      timezone,
    },
    connected: cal.connected,
    needsReconnect: cal.needsReconnect,
    lastSync: cal.lastSync,
    summary: { classesToday, tasksDueToday, overdueTasks },
  };

  return (
    <Dashboard
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      initial={initial}
    />
  );
}