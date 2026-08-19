import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[health] db check failed:", err);
    return NextResponse.json({ status: "degraded", db: "disconnected", timestamp: new Date().toISOString() }, { status: 503 });
  }
}
