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

export interface SettingsDTO {
  reminderEnabled: boolean;
  reminderTime: string;
  timezone: string;
  semesterEnd: string | null;
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