import { describe, expect, it } from "vitest";
import { findOverlap, normalizeSchedule } from "./validators";
import {
  conflictsWithExisting,
  conflictsWithinRows,
  isDuplicateOfExisting,
  mergeDuplicateRows,
  nextOccurrenceInfo,
} from "./scheduleUtils";
import type { ScheduleDTO } from "./types";

const sched = (overrides: Partial<ScheduleDTO>): ScheduleDTO => ({
  id: "s1",
  courseName: "CS 101",
  daysOfWeek: ["MON"],
  startTime: "08:00",
  endTime: "09:30",
  room: null,
  googleEventId: null,
  lastSyncedAt: null,
  synced: false,
  ...overrides,
});

describe("normalizeSchedule", () => {
  it("normalizes days and times", () => {
    const result = normalizeSchedule({
      courseName: "Math",
      daysOfWeek: ["monday", "WED"],
      startTime: "8am",
      endTime: "9:30 AM",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.daysOfWeek).toEqual(["MON", "WED"]);
      expect(result.data.startTime).toBe("08:00");
      expect(result.data.endTime).toBe("09:30");
      expect(result.data.room).toBeNull();
    }
  });

  it("rejects end before start", () => {
    const result = normalizeSchedule({
      courseName: "Math",
      daysOfWeek: ["MON"],
      startTime: "10:00",
      endTime: "09:00",
    });
    expect(result.ok).toBe(false);
  });
});

describe("findOverlap", () => {
  const existing = [
    { id: "a", courseName: "A", daysOfWeek: "MON,WED", startTime: "08:00", endTime: "09:30" },
  ];

  it("detects overlaps on shared days", () => {
    expect(
      findOverlap(existing, { courseName: "B", daysOfWeek: ["MON"], startTime: "09:00", endTime: "10:00" })
    ).not.toBeNull();
  });

  it("ignores different days and non-overlapping times", () => {
    expect(
      findOverlap(existing, { courseName: "B", daysOfWeek: ["TUE"], startTime: "08:00", endTime: "10:00" })
    ).toBeNull();
    expect(
      findOverlap(existing, { courseName: "B", daysOfWeek: ["MON"], startTime: "09:30", endTime: "11:00" })
    ).toBeNull();
  });

  it("skips self by id", () => {
    expect(
      findOverlap(existing, { id: "a", courseName: "A", daysOfWeek: ["MON"], startTime: "08:00", endTime: "09:30" })
    ).toBeNull();
  });
});

describe("mergeDuplicateRows", () => {
  it("unions days for same class at the same time", () => {
    const merged = mergeDuplicateRows([
      { courseName: "CS 101", daysOfWeek: ["MON"], startTime: "08:00", endTime: "09:30", room: "B302" },
      { courseName: "cs 101", daysOfWeek: ["WED"], startTime: "08:00", endTime: "09:30", room: "B302" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].daysOfWeek.sort()).toEqual(["MON", "WED"]);
  });

  it("keeps distinct classes separate", () => {
    const merged = mergeDuplicateRows([
      { courseName: "CS 101", daysOfWeek: ["MON"], startTime: "08:00", endTime: "09:30", room: null },
      { courseName: "PE 1", daysOfWeek: ["MON"], startTime: "08:00", endTime: "09:30", room: null },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe("conflictsWithinRows / conflictsWithExisting", () => {
  it("reports conflicts among selected rows", () => {
    const messages = conflictsWithinRows([
      { courseName: "A", daysOfWeek: ["MON"], startTime: "08:00", endTime: "09:30" },
      { courseName: "B", daysOfWeek: ["MON", "TUE"], startTime: "09:00", endTime: "10:00" },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("MON");
  });

  it("reports conflicts against existing schedule rows", () => {
    const existing = [sched({ courseName: "Saved", daysOfWeek: ["FRI"], startTime: "13:00", endTime: "14:00" })];
    const messages = conflictsWithExisting(
      [{ courseName: "New", daysOfWeek: ["FRI"], startTime: "13:30", endTime: "15:00" }],
      existing
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("Saved");
  });
});

describe("isDuplicateOfExisting", () => {
  it("matches name + time + day regardless of case", () => {
    const existing = [
      sched({ courseName: "cs 101", daysOfWeek: ["MON", "WED"], startTime: "08:00", endTime: "09:30" }),
    ];
    expect(
      isDuplicateOfExisting(
        { courseName: "CS 101", daysOfWeek: ["MON"], startTime: "08:00", endTime: "09:30" },
        existing
      )
    ).toBe(true);
  });

  it("does not match different times", () => {
    const existing = [sched({})];
    expect(
      isDuplicateOfExisting(
        { courseName: "CS 101", daysOfWeek: ["MON"], startTime: "10:00", endTime: "11:30" },
        existing
      )
    ).toBe(false);
  });
});

describe("nextOccurrenceInfo", () => {
  // Fixed instant: Sunday 2026-08-23 17:07 UTC = Monday 01:07 Manila.
  const fixed = new Date("2026-08-23T17:07:00Z");
  const tz = "Asia/Manila";

  it("finds later today", () => {
    const schedules = [sched({ courseName: "Later", daysOfWeek: ["MON"], startTime: "14:00", endTime: "15:00" })];
    const info = nextOccurrenceInfo(schedules, tz, fixed);
    expect(info?.courseName).toBe("Later");
    expect(info?.ongoing).toBe(false);
    expect(info?.minutesUntil).toBe(12 * 60 + 53);
  });

  it("detects an ongoing class", () => {
    const schedules = [sched({ courseName: "Now", daysOfWeek: ["MON"], startTime: "01:00", endTime: "02:00" })];
    const info = nextOccurrenceInfo(schedules, tz, fixed);
    expect(info?.ongoing).toBe(true);
    expect(info?.courseName).toBe("Now");
  });

  it("rolls forward to next week's day when needed", () => {
    const schedules = [sched({ courseName: "Friday", daysOfWeek: ["FRI"], startTime: "08:00", endTime: "09:00" })];
    const info = nextOccurrenceInfo(schedules, tz, fixed);
    expect(info?.day).toBe("FRI");
    // Mon 01:07 -> Fri 08:00 = 4d 6h53m = 4*1440 + 8*60 - 67 = 6173.
    expect(info?.minutesUntil).toBe(6173);
  });

  it("returns null for empty schedules", () => {
    expect(nextOccurrenceInfo([], tz, fixed)).toBeNull();
  });
});
