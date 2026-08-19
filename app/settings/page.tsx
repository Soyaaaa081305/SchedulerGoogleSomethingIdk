import { auth } from "@/auth";
import SignIn from "@/components/SignIn";
import SettingsPage from "@/components/SettingsPage";
import { getOrCreateSettings } from "@/lib/reminder";
import { getCalendarStatus } from "@/lib/api";

export default async function SettingsRoute() {
  const session = await auth();
  if (!session?.user) return <SignIn />;

  const userId = session.user.id;
  const [settings, cal] = await Promise.all([
    getOrCreateSettings(userId),
    getCalendarStatus(userId),
  ]);

  return (
    <SettingsPage
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      settings={{
        reminderEnabled: settings.reminderEnabled,
        reminderTime: settings.reminderTime,
        timezone: settings.timezone,
        semesterEnd: settings.semesterEnd ? settings.semesterEnd.toISOString() : null,
      }}
      connected={cal.connected}
      needsReconnect={cal.needsReconnect}
      lastSync={cal.lastSync}
    />
  );
}