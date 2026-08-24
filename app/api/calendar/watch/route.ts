import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Google Calendar watch webhook — called by Google when a calendar changes.
// Without GCP Pub/Sub configured it just logs and returns 200 (no-op).
export async function POST(req: Request) {
  try {
    const channelId = req.headers.get("x-goog-channel-id");
    const resourceState = req.headers.get("x-goog-resource-state");
    const resourceId = req.headers.get("x-goog-resource-id");

    logger.info("[calendar/watch] notification", { channelId, resourceState, resourceId });

    // In production with Pub/Sub: look up userId by channelId, then sync via syncToken
    // For now, just acknowledge — Google requires 2xx within 10s
    if (resourceState === "sync") {
      return NextResponse.json({ ok: true, type: "sync" });
    }

    // For exists/not_exists: queue a sync job (future: BullMQ/Trigger.dev)
    // await queueSyncForChannel(channelId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("[calendar/watch] failed", { error: String(err) });
    return NextResponse.json({ ok: true }); // still 200 to avoid Google retries storm
  }
}

// Google sends a GET to verify the webhook during channel creation (optional)
export async function GET() {
  return NextResponse.json({ status: "watch endpoint ready", time: new Date().toISOString() });
}
