import { NextResponse } from "next/server";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { buildReminderMessage, getOrCreateSettings } from "@/lib/reminder";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  try {
    const userId = await requireUser();
    const settings = await getOrCreateSettings(userId);
    const message = await buildReminderMessage(userId, settings.timezone);
    const { sent } = await sendPushToUser(userId, message.title, message.body);
    if (sent === 0) {
      throw new ApiError(400, "No push subscription found. Enable browser notifications first.");
    }
    return NextResponse.json({ sent: true, message });
  } catch (err) {
    return handleError(err);
  }
}