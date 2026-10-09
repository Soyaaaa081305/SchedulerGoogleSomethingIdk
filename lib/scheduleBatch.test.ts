import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    schedule: {
      findMany: prismaMock.findMany,
      create: prismaMock.create,
    },
    $transaction: prismaMock.transaction,
  },
}));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

import { createSchedulesForUser } from "@/lib/scheduleService";

const classA = {
  courseName: "CS 101",
  daysOfWeek: ["MON"],
  startTime: "08:00",
  endTime: "09:00",
  room: "B302",
};

describe("createSchedulesForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.findMany.mockResolvedValue([]);
    let id = 0;
    prismaMock.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: `schedule-${++id}`,
        ...data,
        googleEventId: null,
        lastSyncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    );
    prismaMock.transaction.mockImplementation((operations: Promise<unknown>[]) =>
      Promise.all(operations)
    );
  });

  it("normalizes and creates a valid batch in one transaction", async () => {
    const schedules = await createSchedulesForUser("student-1", [
      classA,
      { ...classA, courseName: "Physics", daysOfWeek: ["TUE"], startTime: "10:00", endTime: "11:00" },
    ]);

    expect(prismaMock.transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.create).toHaveBeenCalledTimes(2);
    expect(schedules).toHaveLength(2);
    expect(schedules[0]).toMatchObject({
      courseName: "CS 101",
      daysOfWeek: ["MON"],
      synced: false,
    });
  });

  it("rejects a conflicting row before creating any part of the batch", async () => {
    await expect(
      createSchedulesForUser("student-1", [
        classA,
        { ...classA, courseName: "Physics", startTime: "08:30", endTime: "09:30" },
      ])
    ).rejects.toMatchObject({ status: 409 });

    expect(prismaMock.create).not.toHaveBeenCalled();
    expect(prismaMock.transaction).not.toHaveBeenCalled();
  });

  it("rejects conflicts with saved classes before writing", async () => {
    prismaMock.findMany.mockResolvedValue([
      {
        id: "existing-1",
        courseName: "Existing class",
        daysOfWeek: "MON",
        startTime: "08:30",
        endTime: "09:30",
      },
    ]);

    await expect(createSchedulesForUser("student-1", [classA])).rejects.toMatchObject({ status: 409 });
    expect(prismaMock.create).not.toHaveBeenCalled();
    expect(prismaMock.transaction).not.toHaveBeenCalled();
  });

  it("rejects malformed rows before writing", async () => {
    await expect(createSchedulesForUser("student-1", [classA, { courseName: "Missing time" }])).rejects.toMatchObject({
      status: 400,
    });
    expect(prismaMock.create).not.toHaveBeenCalled();
    expect(prismaMock.transaction).not.toHaveBeenCalled();
  });
});
