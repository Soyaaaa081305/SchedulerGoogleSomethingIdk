import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReminderMessage } from "@/lib/reminder";
import { sendPushToUser } from "@/lib/push";
import { timeNowInTz } from "@/lib/days";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    include: {
      settings: true,
      _count: { select: { pushSubs: true } },
    },
  });

  const results: Array<{ userId: string; sent: number; skipped: boolean; reason?: string }> = [];

  for (const user of users) {
    const settings = user.settings;

    // No settings row (user never opened the app) or reminders turned off.
    if (!settings || !settings.reminderEnabled) {
      results.push({ userId: user.id, sent: 0, skipped: true, reason: "reminders-disabled" });
      continue;
    }

    // Nothing to deliver to.
    if (user._count.pushSubs === 0) {
      results.push({ userId: user.id, sent: 0, skipped: true, reason: "no-push-subscription" });
      continue;
    }

    // The cron fires once a day; only ring users whose configured reminder
    // time matches "now" in their own timezone.
    const nowLocal = timeNowInTz(settings.timezone);
    if (!nowLocal || nowLocal !== settings.reminderTime) {
      results.push({
        userId: user.id,
        sent: 0,
        skipped: true,
        reason: `time-mismatch (local ${nowLocal ?? "?"} vs ${settings.reminderTime})`,
      });
      continue;
    }

    try {
      const message = await buildReminderMessage(user.id, settings.timezone);
      const { sent } = await sendPushToUser(user.id, message.title, message.body);
      results.push({ userId: user.id, sent, skipped: false });
    } catch (err) {
      console.error("[cron] reminder failed for user", user.id, err);
      results.push({ userId: user.id, sent: 0, skipped: true, reason: "delivery-error" });
    }
  }

  const totalSent = results.reduce((acc, r) => acc + r.sent, 0);
  return NextResponse.json({ ok: true, users: results.length, totalSent, results });
}
