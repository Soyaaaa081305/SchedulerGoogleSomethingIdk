import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new ApiError(401, "Not authenticated");
  return userId;
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[api]", err);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}

export async function getCalendarStatus(userId: string) {
  const account = await prisma.account.findFirst({ where: { userId } });
  if (!account?.access_token && !account?.refresh_token) {
    return { connected: false, needsReconnect: false, lastSync: null };
  }
  const hasCalendarScope = (account.scope ?? "").includes("calendar.events");
  if (!hasCalendarScope) {
    return { connected: false, needsReconnect: true, lastSync: null };
  }
  const last = await prisma.schedule.findFirst({
    where: { userId, lastSyncedAt: { not: null } },
    orderBy: { lastSyncedAt: "desc" },
  });
  return { connected: true, needsReconnect: false, lastSync: last?.lastSyncedAt?.toISOString() ?? null };
}