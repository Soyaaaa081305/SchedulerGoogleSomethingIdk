import { auth } from "@/auth";
import SignIn from "@/components/SignIn";
import Dashboard, { type InitialData } from "@/components/Dashboard";
import { prisma } from "@/lib/prisma";
import { getOrCreateSettings } from "@/lib/reminder";
import { getCalendarStatus } from "@/lib/api";
import { toScheduleDTO } from "@/lib/types";
import { weekdayInTz } from "@/lib/days";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    return <SignIn />;
  }

  const userId = session.user.id;
  const settings = await getOrCreateSettings(userId);
  const timezone = settings.timezone;

  const [schedules, cal] = await Promise.all([
    prisma.schedule.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    getCalendarStatus(userId),
  ]);

  const weekday = weekdayInTz(timezone);
  const classesToday = schedules
    .filter((s) => s.daysOfWeek.split(",").includes(weekday ?? ""))
    .map((s) => s.courseName);

  const initial: InitialData = {
    schedules: schedules.map(toScheduleDTO),
    settings: {
      reminderEnabled: settings.reminderEnabled,
      reminderTime: settings.reminderTime,
      timezone,
      semesterEnd: settings.semesterEnd ? settings.semesterEnd.toISOString() : null,
    },
    connected: cal.connected,
    needsReconnect: cal.needsReconnect,
    lastSync: cal.lastSync,
    summary: { classesToday },
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