import { describe, expect, it } from "vitest";
import {
  formatTime12h,
  minutesNowInTz,
  nextDateForDay,
  normalizeDay,
  normalizeTime,
  timeNowInTz,
  tomorrowWeekdayInTz,
} from "./days";

describe("normalizeTime", () => {
  it("parses plain 24h times", () => {
    expect(normalizeTime("8:00")).toBe("08:00");
    expect(normalizeTime("21:00")).toBe("21:00");
  });

  it("parses am/pm with or without space", () => {
    expect(normalizeTime("8:00 AM")).toBe("08:00");
    expect(normalizeTime("8am")).toBe("08:00");
    expect(normalizeTime("7:30PM")).toBe("19:30");
    expect(normalizeTime("12:00 am")).toBe("00:00");
    expect(normalizeTime("12:30 pm")).toBe("12:30");
  });

  it("parses military style", () => {
    expect(normalizeTime("0800")).toBe("08:00");
    expect(normalizeTime("1330")).toBe("13:30");
  });

  it("parses noon and midnight", () => {
    expect(normalizeTime("noon")).toBe("12:00");
    expect(normalizeTime("midnight")).toBe("00:00");
  });

  it("takes the start side of a merged range", () => {
    expect(normalizeTime("8:00 AM - 9:30 AM")).toBe("08:00");
    expect(normalizeTime("08:30-09:20")).toBe("08:30");
    expect(normalizeTime("9:40 to 11:10")).toBe("09:40");
  });

  it("rejects nonsense", () => {
    expect(normalizeTime("25:00")).toBeNull();
    expect(normalizeTime("8:61")).toBeNull();
    expect(normalizeTime("abc")).toBeNull();
    expect(normalizeTime("")).toBeNull();
  });
});

describe("normalizeDay", () => {
  it("accepts common aliases", () => {
    expect(normalizeDay("MONDAY")).toBe("MON");
    expect(normalizeDay("Thurs")).toBe("THU");
    expect(normalizeDay("WEDNESDAY.")).toBe("WED");
    expect(normalizeDay("sun")).toBe("SUN");
  });

  it("rejects non-days", () => {
    expect(normalizeDay("Xyz")).toBeNull();
    expect(normalizeDay("")).toBeNull();
  });
});

describe("timezone helpers", () => {
  const fixed = new Date("2026-08-23T17:07:00Z"); // Mon 01:07 in Manila

  it("formats current time in a timezone", () => {
    expect(timeNowInTz("Asia/Manila", fixed)).toBe("01:07");
    expect(minutesNowInTz("Asia/Manila", fixed)).toBe(67);
  });

  it("gives tomorrow's weekday in the timezone", () => {
    // Manila is already Monday 01:07 — tomorrow is Tuesday.
    expect(tomorrowWeekdayInTz("Asia/Manila", fixed)).toBe("TUE");
    // UTC is still Sunday 17:07 — tomorrow is Monday.
    expect(tomorrowWeekdayInTz("UTC", fixed)).toBe("MON");
  });

  it("handles invalid timezones gracefully", () => {
    expect(timeNowInTz("Not/AZone", fixed)).toBeNull();
    expect(minutesNowInTz("Not/AZone", fixed)).toBeNull();
  });

  it("finds the next date for a day code", () => {
    // From Sunday 2026-08-23 UTC, the next TUE is 2026-08-25.
    expect(nextDateForDay("TUE", "UTC", fixed)).toBe("2026-08-25");
    // Next SUN from a Sunday is... itself (i=0).
    expect(nextDateForDay("SUN", "UTC", fixed)).toBe("2026-08-23");
  });
});

describe("formatTime12h", () => {
  it("formats midnight, noon, and afternoon", () => {
    expect(formatTime12h("00:15")).toBe("12:15 AM");
    expect(formatTime12h("12:00")).toBe("12:00 PM");
    expect(formatTime12h("14:05")).toBe("2:05 PM");
  });
});
