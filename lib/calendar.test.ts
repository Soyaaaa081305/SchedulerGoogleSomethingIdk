import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

import {
  createOrReuseWeeklyEvent,
  scheduleCalendarEventId,
  type CalendarClient,
  type CreateEventInput,
} from "@/lib/calendar";

const input: CreateEventInput = {
  scheduleId: "schedule-cuid-123",
  courseName: "CS 101",
  daysOfWeek: ["MON"],
  startTime: "08:00",
  endTime: "09:00",
  room: "B302",
  timezone: "Asia/Manila",
};

function makeCalendar() {
  return {
    events: {
      list: vi.fn().mockResolvedValue({ data: { items: [] } }),
      get: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    },
  } as unknown as CalendarClient & {
    events: {
      list: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      insert: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
}

describe("calendar event idempotency", () => {
  it("generates a stable Google-compatible ID for each saved class", () => {
    const first = scheduleCalendarEventId(input.scheduleId!);
    expect(first).toMatch(/^[0-9a-f]{40}$/);
    expect(scheduleCalendarEventId(input.scheduleId!)).toBe(first);
    expect(scheduleCalendarEventId("another-schedule")).not.toBe(first);
  });

  it("uses the stable ID when inserting a new recurring event", async () => {
    const calendar = makeCalendar();
    const eventId = scheduleCalendarEventId(input.scheduleId!);
    calendar.events.insert.mockResolvedValue({ data: { id: eventId } });

    await expect(createOrReuseWeeklyEvent(calendar, input)).resolves.toEqual({ id: eventId });
    expect(calendar.events.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          id: eventId,
          extendedProperties: { private: { schedulerScheduleId: input.scheduleId } },
        }),
      })
    );
  });

  it("reuses the event when overlapping retries collide on the stable ID", async () => {
    const calendar = makeCalendar();
    const eventId = scheduleCalendarEventId(input.scheduleId!);
    const conflict = Object.assign(new Error("event already exists"), { response: { status: 409 } });
    calendar.events.insert.mockRejectedValue(conflict);
    calendar.events.get.mockResolvedValue({
      data: {
        id: eventId,
        extendedProperties: { private: { schedulerScheduleId: input.scheduleId } },
      },
    });

    await expect(createOrReuseWeeklyEvent(calendar, input)).resolves.toEqual({ id: eventId });
    expect(calendar.events.insert).toHaveBeenCalledTimes(1);
    expect(calendar.events.get).toHaveBeenCalledWith({ calendarId: "primary", eventId });
  });

  it("updates the matching event on a later retry instead of inserting another", async () => {
    const calendar = makeCalendar();
    calendar.events.list.mockResolvedValueOnce({ data: { items: [{ id: "existing-event" }] } });
    calendar.events.update.mockResolvedValue({ data: { id: "existing-event" } });

    await expect(createOrReuseWeeklyEvent(calendar, input)).resolves.toEqual({ id: "existing-event" });
    expect(calendar.events.update).toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "primary", eventId: "existing-event" })
    );
    expect(calendar.events.insert).not.toHaveBeenCalled();
  });
});
