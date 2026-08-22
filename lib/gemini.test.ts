import { describe, expect, it } from "vitest";
import { parseCoursesResponse } from "./gemini";

describe("parseCoursesResponse", () => {
  it("normalizes and de-duplicates AI output", () => {
    const parsed = parseCoursesResponse({
      courses: [
        { courseName: " CS 101 ", daysOfWeek: ["MONDAY", "Mon"], startTime: "8:00 AM", endTime: "9:30 AM", room: "B302" },
        { courseName: "CS 101", daysOfWeek: ["MON"], startTime: "08:00", endTime: "09:30", room: "B302" },
        { courseName: "", daysOfWeek: ["TUE"], startTime: "08:00", endTime: "09:00" },
        { courseName: "No Days", daysOfWeek: [], startTime: "08:00", endTime: "09:00" },
        { courseName: "Bad Time", daysOfWeek: ["MON"], startTime: "when?", endTime: "09:00" },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      courseName: "CS 101",
      daysOfWeek: ["MON"],
      startTime: "08:00",
      endTime: "09:30",
      room: "B302",
    });
  });

  it("tolerates null/undefined payloads", () => {
    expect(parseCoursesResponse(null)).toEqual([]);
    expect(parseCoursesResponse(undefined)).toEqual([]);
    expect(parseCoursesResponse({})).toEqual([]);
  });
});
