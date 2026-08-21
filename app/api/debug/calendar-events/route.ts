import { NextResponse } from "next/server";
import { requireUser, handleError } from "@/lib/api";
import { getCalendarForUser } from "@/lib/calendar";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUser();
    const calendar = await getCalendarForUser(userId);
    if (!calendar) {
      return NextResponse.json({ error: "Not connected" }, { status: 403 });
    }

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const events: Array<{
      id: string;
      summary: string;
      start: string;
      hasRRule: boolean;
      rrule: string;
      description: string;
    }> = [];

    let pageToken: string | undefined;
    do {
      const res = await calendar.events.list({
        calendarId: "primary",
        timeMin: twoYearsAgo.toISOString(),
        singleEvents: false,
        maxResults: 250,
        pageToken,
      });
      for (const ev of res.data.items ?? []) {
        if (!ev.id) continue;
        events.push({
          id: ev.id,
          summary: ev.summary ?? "(no title)",
          start: ev.start?.dateTime ?? ev.start?.date ?? "?",
          hasRRule: Boolean(ev.recurrence?.[0]),
          rrule: ev.recurrence?.[0] ?? "",
          description: (ev.description ?? "").slice(0, 100),
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    const linkedEvents = events.filter((e) =>
      e.description.includes("Created by Scheduler")
    );
    const recurringNoMarker = events.filter(
      (e) => e.hasRRule && !e.description.includes("Created by Scheduler")
    );
    const individual = events.filter((e) => !e.hasRRule);

    return NextResponse.json({
      total: events.length,
      linkedCount: linkedEvents.length,
      recurringNoMarkerCount: recurringNoMarker.length,
      individualCount: individual.length,
      sampleLinked: linkedEvents.slice(0, 5).map((e) => e.summary),
      sampleRecurring: recurringNoMarker.slice(0, 10).map((e) => ({
        summary: e.summary,
        rrule: e.rrule.slice(0, 80),
        start: e.start,
      })),
      sampleIndividual: individual.slice(0, 10).map((e) => ({
        summary: e.summary,
        start: e.start,
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}
