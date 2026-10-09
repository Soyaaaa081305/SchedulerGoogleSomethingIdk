"use client";

import { useState } from "react";
import { Button, DayPicker, ErrorBanner, Modal } from "@/components/ui";
import { useToast } from "@/components/ToastProvider";
import type { Day } from "@/lib/days";
import type { ScheduleDTO } from "@/lib/types";
import type { ParsedCourse } from "@/lib/gemini";
import { saveSchedule } from "@/lib/scheduleClient";

export default function AddClassModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (s: ScheduleDTO) => void;
}) {
  const { toast } = useToast();
  const [courseName, setCourseName] = useState("");
  const [days, setDays] = useState<Day[]>([]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:30");
  const [room, setRoom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setCourseName("");
    setDays([]);
    setStartTime("08:00");
    setEndTime("09:30");
    setRoom("");
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (!courseName.trim()) {
      setError("Give the class a name.");
      return;
    }
    if (days.length === 0) {
      setError("Pick at least one day.");
      return;
    }
    setBusy(true);
    try {
      const payload: ParsedCourse & { semesterEnd?: string } = {
        courseName: courseName.trim(),
        daysOfWeek: days,
        startTime,
        endTime,
        room: room.trim() || null,
      };
      const schedule = await saveSchedule(payload);
      onSaved(schedule);
      toast("success", `"${schedule.courseName}" saved. Calendar sync is running in the background.`);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the class");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Add a class" closeDisabled={busy}>
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-black text-zinc-900">Add a class</h2>
        <p className="mt-1 text-sm text-zinc-600">
          For classes the photo missed — or when you don&apos;t have your
          timetable handy.
        </p>

        <div className="mt-4 space-y-3">
          <input
            type="text"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="Course name (e.g. CS 101)"
            aria-label="Course name"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5 text-zinc-600">
              Start
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
              />
            </label>
            <label className="flex items-center gap-1.5 text-zinc-600">
              End
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
              />
            </label>
            <label className="flex items-center gap-1.5 text-zinc-600">
              Room
              <input
                type="text"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Optional"
                className="min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
              />
            </label>
          </div>
          <DayPicker value={days} onChange={setDays} />
        </div>

        {error && (
          <div className="mt-4">
            <ErrorBanner message={error} />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Saving…" : "Add class"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
