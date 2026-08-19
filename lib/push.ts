import webpush from "web-push";
import { prisma } from "@/lib/prisma";

function vapidDetailsConfigured(): boolean {
  return Boolean(
    process.env.VAPID_SUBJECT &&
      process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY
  );
}

function getVapidDetails() {
  if (!vapidDetailsConfigured()) {
    throw new Error("VAPID keys are not configured");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string
): Promise<{ sent: number; removed: number }> {
  if (!vapidDetailsConfigured()) return { sent: 0, removed: 0 };
  getVapidDetails();

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let removed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keysP256dh, auth: sub.keysAuth },
        },
        JSON.stringify({ title, body })
      );
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        removed += 1;
      }
    }
  }
  return { sent: subs.length - removed, removed };
}