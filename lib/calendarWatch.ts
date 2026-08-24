import { getCalendarForUser } from "@/lib/calendar";
import { logger } from "@/lib/logger";

// Scaffolding for Google Calendar push notifications.
// Requires GCP Pub/Sub + a public https URL (Vercel handles this).
// If not configured, this is a no-op and the app falls back to cron polling.

export async function ensureWatchForUser(userId: string) {
  const watchUrl = process.env.GOOGLE_WATCH_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/calendar/watch` : null);
  if (!watchUrl) {
    logger.debug("[watch] no watch URL configured, skipping", { userId });
    return null;
  }

  try {
    const calendar = await getCalendarForUser(userId);
    if (!calendar) return null;

    const channelId = `sched-${userId}-${Date.now()}`;
    const res = await (calendar.events as unknown as { watch: (opts: unknown) => Promise<{ data: unknown }> }).watch({
      calendarId: "primary",
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: watchUrl,
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info("[watch] channel created", { userId, channelId, expiration: (res.data as { expiration?: string })?.expiration });
    // TODO: persist channelId/resourceId to DB for later stop/renew
    return res.data;
  } catch (err) {
    logger.warn("[watch] failed to create channel", { userId, error: String(err) });
    return null;
  }
}
