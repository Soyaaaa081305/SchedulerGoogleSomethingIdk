import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { signIcalToken } from "@/lib/icalToken";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await requireUser();
  const token = signIcalToken(userId);
  const url = new URL(`/api/ical/${token}`, req.url);
  // return https in prod even if req is http
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const origin = `${proto}://${host}`;
  const feedUrl = `${origin}/api/ical/${token}`;
  return NextResponse.json({ token, feedUrl });
}
