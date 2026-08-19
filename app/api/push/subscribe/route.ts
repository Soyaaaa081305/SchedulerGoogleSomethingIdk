import { NextResponse } from "next/server";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { pushSubscribeSchema } from "@/lib/validators";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const userId = await requireUser();
    const body = await req.json();
    const parsed = pushSubscribeSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "Invalid push subscription");

    const { endpoint, keys } = parsed.data.subscription;
    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } });

    if (existing) {
      const updated = await prisma.pushSubscription.update({
        where: { endpoint },
        data: { keysP256dh: keys.p256dh, keysAuth: keys.auth, userId },
      });
      return NextResponse.json({ ok: true, id: updated.id });
    }

    const created = await prisma.pushSubscription.create({
      data: { userId, endpoint, keysP256dh: keys.p256dh, keysAuth: keys.auth },
    });
    return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}