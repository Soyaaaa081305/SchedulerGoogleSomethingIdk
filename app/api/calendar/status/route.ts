import { NextResponse } from "next/server";
import { requireUser, handleError, getCalendarStatus } from "@/lib/api";

export async function GET() {
  try {
    const userId = await requireUser();
    return NextResponse.json(await getCalendarStatus(userId));
  } catch (err) {
    return handleError(err);
  }
}