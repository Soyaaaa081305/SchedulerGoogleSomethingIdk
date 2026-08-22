import { describe, expect, it } from "vitest";
import { schedulesToICS } from "./ics";

const schedules = [
  {
    id: "abc",
    courseName: "CS 101, Section A",
    daysOfWeek: ["MON", "WED"],
    startTime: "08:30",
    endTime: "09:30",
    room: "MCL B302",
  },
];

describe("schedulesToICS", () => {
  it("produces a valid calendar with escaped text", () => {
    const ics = schedulesToICS(schedules, {
      timezone: "Asia/Manila",
      semesterEnd: "2026-12-01T00:00:00.000Z",
      now: new Date("2026-08-23T00:00:00Z"),
    });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("X-WR-TIMEZONE:Asia/Manila");
    expect(ics).toContain("SUMMARY:CS 101\\, Section A");
    expect(ics).toContain("LOCATION:MCL B302");
    // BYDAY uses RRULE codes
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261201T235959Z");
    // DTSTART is anchored on the next Monday (2026-08-24) in local time
    expect(ics).toContain("DTSTART;TZID=Asia/Manila:20260824T083000");
    expect(ics).toContain("DTEND;TZID=Asia/Manila:20260824T093000");
    // CRLF line endings per RFC 5545
    expect(ics.includes("\r\n")).toBe(true);
  });

  it("skips rows without days and uses default UNTIL ~4 months out", () => {
    const ics = schedulesToICS(
      [{ ...schedules[0], daysOfWeek: ["MON", "WED"] }],
      { timezone: "UTC", semesterEnd: null, now: new Date("2026-08-23T00:00:00Z") }
    );
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UNTIL=");
  });
});
