import { NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";

export async function GET() {
  try {
    await requireUser();
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return NextResponse.json({ publicKey: null }, { status: 200 });
    }
    return NextResponse.json({ publicKey });
  } catch (err) {
    return handleError(err);
  }
}