import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
  const checks: Record<string, string> = {};
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = `connected (${Date.now() - start}ms)`;
  } catch (err) {
    logger.error("[health] db check failed", { error: String(err) });
    checks.db = "disconnected";
    return NextResponse.json({ status: "degraded", checks, timestamp: new Date().toISOString() }, { status: 503 });
  }

  checks.env = process.env.NEXTAUTH_SECRET && process.env.DATABASE_URL ? "ok" : "missing env";
  checks.auth = process.env.GOOGLE_CLIENT_ID ? "configured" : "missing google";
  checks.ai = process.env.GEMINI_API_KEY ? "configured" : "missing gemini";
  checks.push = process.env.VAPID_PUBLIC_KEY ? "configured" : "not configured";

  const degraded = Object.values(checks).some((v) => v.includes("missing") || v.includes("disconnected"));
  return NextResponse.json({ status: degraded ? "degraded" : "ok", checks, timestamp: new Date().toISOString() }, { status: degraded ? 200 : 200 });
}
