"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  Button,
  DayPicker,
  ErrorBanner,
  NoticeBanner,
  Spinner,
} from "@/components/ui";
import type { ScheduleDTO } from "@/lib/types";
import type { ParsedCourse } from "@/lib/gemini";
import type { Day } from "@/lib/days";
import { useToast } from "@/components/ToastProvider";

interface Row extends ParsedCourse {
  id: string;
  selected: boolean;
}

async function uploadImage(file: File): Promise<ParsedCourse[]> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Upload failed");
  }
  const data = (await res.json()) as { courses: ParsedCourse[] };
  return data.courses;
}

async function saveSchedule(row: ParsedCourse): Promise<ScheduleDTO> {
  const res = await fetch("/api/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  const data = (await res.json().catch(() => null)) as {
    schedule?: ScheduleDTO;
    error?: string;
  } | null;
  if (!res.ok) {
    throw new Error(data?.error ?? "Could not add to Google Calendar");
  }
  return data!.schedule!;
}

function CourseRowEditor({
  row,
  onChange,
}: {
  row: Row;
  onChange: (row: Row) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={row.selected}
          onChange={(e) => onChange({ ...row, selected: e.target.checked })}
          className="h-4 w-4 accent-[#c8102e]"
          aria-label={`Select ${row.courseName}`}
        />
        <input
          type="text"
          value={row.courseName}
          onChange={(e) => onChange({ ...row, courseName: e.target.value })}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
          placeholder="Course name"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5 text-zinc-600">
          Start
          <input
            type="time"
            value={row.startTime}
            onChange={(e) => onChange({ ...row, startTime: e.target.value })}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
          />
        </label>
        <label className="flex items-center gap-1.5 text-zinc-600">
          End
          <input
            type="time"
            value={row.endTime}
            onChange={(e) => onChange({ ...row, endTime: e.target.value })}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
          />
        </label>
        <label className="flex items-center gap-1.5 text-zinc-600">
          Room
          <input
            type="text"
            value={row.room ?? ""}
            onChange={(e) => onChange({ ...row, room: e.target.value || null })}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
            placeholder="Room (optional)"
          />
        </label>
      </div>

      <DayPicker
        value={row.daysOfWeek as Day[]}
        onChange={(days) => onChange({ ...row, daysOfWeek: days })}
      />
    </div>
  );
}

export default function UploadCard({ onSaved }: { onSaved: (s: ScheduleDTO) => void }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setNotice(null);
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image. Upload a photo or screenshot of your schedule.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    try {
      const courses = await uploadImage(file);
      if (courses.length === 0) {
        setError("No courses were detected in that image. Try a clearer photo of your timetable.");
      } else {
        setRows(courses.map((c, i) => ({ ...c, id: `new-${i}-${Date.now()}`, selected: true })));
        setNotice(`Found ${courses.length} course${courses.length > 1 ? "s" : ""}. Review the details below, then add them to your Google Calendar.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }, [previewUrl]);

  const saveSelected = async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;
    setSaving(true);
    setError(null);
    const savedIds = new Set<string>();
    try {
      for (const row of selected) {
        const dto = await saveSchedule({
          courseName: row.courseName,
          daysOfWeek: row.daysOfWeek,
          startTime: row.startTime,
          endTime: row.endTime,
          room: row.room,
        });
        savedIds.add(row.id);
        onSaved(dto);
      }
      setRows((prev) => prev.filter((r) => !savedIds.has(r.id)));
      setNotice(`Added ${savedIds.size} course${savedIds.size > 1 ? "s" : ""} to your schedule and Google Calendar.`);
      toast("success", `Added ${savedIds.size} course${savedIds.size > 1 ? "s" : ""} to your schedule and Google Calendar.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add to Google Calendar";
      setError(message);
      toast("error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Upload your schedule">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload schedule image"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        onPaste={(e) => {
          const items = e.clipboardData?.items;
          if (!items) return;
          for (const item of items) {
            if (item.type.startsWith("image/")) {
              e.preventDefault();
              const file = item.getAsFile();
              if (file) void handleFile(file);
              break;
            }
          }
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragging
            ? "border-[#c8102e] bg-[#fdeeef]"
            : "border-zinc-300 hover:border-[#c8102e]"
        }`}
      >
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Your uploaded schedule"
              className="max-h-64 w-auto rounded-lg border border-zinc-200 shadow-sm"
            />
            <p className="text-sm font-medium text-zinc-800">
              Looking good! Click or paste another image to replace it.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-zinc-800">
              Drop a photo of your class schedule here
            </p>
            <p className="text-xs text-zinc-500">
              or click to browse, or just paste (Ctrl/Cmd + V) — a photo or
              screenshot of your timetable works best
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {loading && (
        <div className="mt-4 flex justify-center">
          <Spinner label="Reading your schedule…" />
        </div>
      )}

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {notice && (
        <div className="mt-4">
          <NoticeBanner message={notice} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-zinc-600">
            Review what the AI read — edit anything that looks wrong, tick the
            classes you want, then add them to your calendar.
          </p>
          {rows.map((row) => (
            <CourseRowEditor
              key={row.id}
              row={row}
              onChange={(updated) =>
                setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
              }
            />
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void saveSelected()}
              disabled={saving || rows.every((r) => !r.selected)}
            >
              {saving
                ? "Adding…"
                : `Add ${rows.filter((r) => r.selected).length} to Google Calendar`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRows([]);
                setNotice(null);
                setError(null);
                setLoading(false);
                setSaving(false);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}