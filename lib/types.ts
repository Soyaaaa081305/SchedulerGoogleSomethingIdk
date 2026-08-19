export interface ScheduleDTO {
  id: string;
  courseName: string;
  daysOfWeek: string[];
  startTime: string;
  endTime: string;
  room: string | null;
  googleEventId: string | null;
  lastSyncedAt: string | null;
  synced: boolean;
}

export interface TaskDTO {
  id: string;
  title: string;
  dueDate: string | null;
  source: "manual" | "bbl";
  completed: boolean;
  createdAt: string;
}

export interface SettingsDTO {
  reminderEnabled: boolean;
  reminderTime: string;
  timezone: string;
}

export function toScheduleDTO(
  s: {
    id: string;
    courseName: string;
    daysOfWeek: string;
    startTime: string;
    endTime: string;
    room: string | null;
    googleEventId: string | null;
    lastSyncedAt: Date | null;
  }
): ScheduleDTO {
  return {
    id: s.id,
    courseName: s.courseName,
    daysOfWeek: s.daysOfWeek ? s.daysOfWeek.split(",") : [],
    startTime: s.startTime,
    endTime: s.endTime,
    room: s.room,
    googleEventId: s.googleEventId,
    lastSyncedAt: s.lastSyncedAt ? s.lastSyncedAt.toISOString() : null,
    synced: Boolean(s.googleEventId && s.lastSyncedAt),
  };
}

export function toTaskDTO(
  t: {
    id: string;
    title: string;
    dueDate: Date | null;
    source: string;
    completed: boolean;
    createdAt: Date;
  }
): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    source: t.source === "bbl" ? "bbl" : "manual",
    completed: t.completed,
    createdAt: t.createdAt.toISOString(),
  };
}