import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError } from "@/lib/api";
import { getCalendarForUser } from "@/lib/calendar";

export const dynamic = "force-dynamic";

const WEEKLY_RRULE = /RRULE:FREQ=WEEKLY/;

const CLASS_PATTERNS = [
  /^(CCS|STS|GE|HUMASS|NSTP|PE|MATH|PHYS|CHEM|BIO|ENG|FIL|SOCIO|HIST|ECON|POLSCI|PSYCHO|PATHFIT|REMVISION)/i,
  /\b\d{4}\b/,
  /\b(sitio|room|rm|bldg|building)\b/i,
];

function looksLikeClassName(summary: string): boolean {
  return CLASS_PATTERNS.some((p) => p.test(summary));
}

export async function POST(req: Request) {
  try {
    const userId = await requireUser();
    const calendar = await getCalendarForUser(userId);
    if (!calendar) {
      return NextResponse.json(
        { error: "Google Calendar is not connected. Reconnect in Settings." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const aggressive = searchParams.get("aggressive") === "1";

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const mySchedules = await prisma.schedule.findMany({
      where: { userId },
      select: { googleEventId: true, courseName: true },
    });
    const linkedIds = new Set(
      mySchedules.map((s) => s.googleEventId).filter(Boolean)
    );
    const myCourseNames = new Set(
      mySchedules.map((s) => s.courseName.trim().toLowerCase())
    );

    let pageToken: string | undefined;
    let candidates = 0;
    let deleted = 0;

    do {
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: twoYearsAgo.toISOString(),
        singleEvents: false,
        maxResults: 250,
        pageToken,
      });

      for (const ev of res.data.items ?? []) {
        if (linkedIds.has(ev.id ?? "")) continue;
        if (!ev.id) continue;

        const rrule = ev.recurrence?.[0] ?? "";
        const hasWeeklyRRule = WEEKLY_RRULE.test(rrule);

        const hasMarker =
          ev.description?.includes("Created by Scheduler") ?? false;

        const isKnownClass = myCourseNames.has(
          (ev.summary ?? "").trim().toLowerCase()
        );

        if (aggressive) {
          if (hasMarker) {
            candidates++;
            await calendar.events
              .delete({ calendarId: "primary", eventId: ev.id })
              .catch(() => {});
            deleted++;
            continue;
          }
          if (hasWeeklyRRule && isKnownClass) {
            candidates++;
            await calendar.events
              .delete({ calendarId: "primary", eventId: ev.id })
              .catch(() => {});
            deleted++;
            continue;
          }
          if (hasWeeklyRRule && looksLikeClassName(ev.summary ?? "")) {
            candidates++;
            await calendar.events
              .delete({ calendarId: "primary", eventId: ev.id })
              .catch(() => {});
            deleted++;
            continue;
          }
          continue;
        }

        if (!hasMarker && !isKnownClass) continue;
        if (!hasWeeklyRRule && !hasMarker) continue;

        candidates++;
        await calendar.events
          .delete({ calendarId: "primary", eventId: ev.id })
          .catch(() => {});
        deleted++;
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return NextResponse.json({ ok: true, deleted, candidates });
  } catch (err) {
    return handleError(err);
  }
}
