import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReminderMessage } from "@/lib/reminder";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  if (header && header === secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    include: { settings: true },
  });

  const results: Array<{ userId: string; sent: number; skipped: boolean }> = [];

  for (const user of users) {
    const settings = user.settings;
    if (!settings || !settings.reminderEnabled) {
      results.push({ userId: user.id, sent: 0, skipped: true });
      continue;
    }

    const message = await buildReminderMessage(user.id, settings.timezone);
    const { sent } = await sendPushToUser(user.id, message.title, message.body);
    results.push({ userId: user.id, sent, skipped: false });
  }

  const totalSent = results.reduce((acc, r) => acc + r.sent, 0);
  return NextResponse.json({ ok: true, users: results.length, totalSent });
}