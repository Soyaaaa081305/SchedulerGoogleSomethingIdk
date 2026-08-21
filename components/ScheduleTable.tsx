"use client";

import { useState } from "react";
import { Card, Button, DayPicker, DayBadges, ErrorBanner } from "@/components/ui";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import type { ScheduleDTO } from "@/lib/types";
import type { Day } from "@/lib/days";
import { formatTime12h } from "@/lib/days";

export default function ScheduleTable({
  schedules,
  onChange,
}: {
  schedules: ScheduleDTO[];
  onChange: (schedules: ScheduleDTO[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScheduleDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ScheduleDTO | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const { toast } = useToast();

  const startEdit = (s: ScheduleDTO) => {
    setEditingId(s.id);
    setDraft({ ...s, daysOfWeek: [...s.daysOfWeek] });
  };

  const saveEdit = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedules/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: draft.courseName,
          daysOfWeek: draft.daysOfWeek,
          startTime: draft.startTime,
          endTime: draft.endTime,
          room: draft.room,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        schedule?: ScheduleDTO;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "Could not update schedule");
      onChange(schedules.map((s) => (s.id === draft.id ? data!.schedule! : s)));
      setEditingId(null);
      toast("success", `"${draft.courseName}" updated.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update failed";
      setError(message);
      toast("error", message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: ScheduleDTO) => {
    setDeleting(null);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/schedules/${s.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete schedule");
      onChange(schedules.filter((x) => x.id !== s.id));
      toast("success", `"${s.courseName}" removed.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      setError(message);
      toast("error", message);
    } finally {
      setBusy(false);
    }
  };

  const removeAll = async () => {
    setDeletingAll(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/schedules/all", { method: "DELETE" });
      const data = (await res.json().catch(() => null)) as { deleted?: number } | null;
      if (!res.ok) throw new Error("Could not delete classes");
      onChange([]);
      toast("success", `Deleted ${data?.deleted ?? 0} class${(data?.deleted ?? 0) !== 1 ? "es" : ""} and their Google Calendar events.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete all failed";
      setError(message);
      toast("error", message);
    } finally {
      setBusy(false);
    }
  };

  if (schedules.length === 0) {
    return (
      <Card title="Your schedule">
        <p className="text-sm text-zinc-500">
          No classes yet. Upload your timetable above, or add classes once
          they&apos;re extracted.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Your schedule">
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}
      <div className="mb-4 flex items-center justify-end">
        <Button
          variant="danger"
          onClick={() => setDeletingAll(true)}
          disabled={busy}
          aria-label="Delete all classes"
        >
          {busy ? "Deleting…" : "Delete all"}
        </Button>
      </div>
      <div className="space-y-3">
        {schedules.map((s) =>
          editingId === s.id && draft ? (
            <div key={s.id} className="flex flex-col gap-3 rounded-xl border border-[#f3c8cf] bg-[#fdf7f8] p-3">
              <input
                type="text"
                value={draft.courseName}
                onChange={(e) => setDraft({ ...draft, courseName: e.target.value })}
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
              />
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex min-w-0 items-center gap-1.5 text-zinc-600">
                  Start
                  <input
                    type="time"
                    value={draft.startTime}
                    onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
                    className="min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
                  />
                </label>
                <label className="flex min-w-0 items-center gap-1.5 text-zinc-600">
                  End
                  <input
                    type="time"
                    value={draft.endTime}
                    onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
                    className="min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
                  />
                </label>
                <label className="flex min-w-0 items-center gap-1.5 text-zinc-600">
                  Room
                  <input
                    type="text"
                    value={draft.room ?? ""}
                    onChange={(e) => setDraft({ ...draft, room: e.target.value || null })}
                    className="min-w-0 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
                  />
                </label>
              </div>
              <DayPicker value={draft.daysOfWeek as Day[]} onChange={(days) => setDraft({ ...draft, daysOfWeek: days })} />
              <div className="flex gap-2">
                <Button onClick={() => void saveEdit()} disabled={busy}>
                  Save
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingId(null);
                    setDraft(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300"
            >
              <div className="min-w-0">
                <p className="font-semibold text-zinc-900">{s.courseName}</p>
                <p className="text-sm text-zinc-500">
                  <span className="font-medium text-zinc-600">
                    {formatTime12h(s.startTime)} – {formatTime12h(s.endTime)}
                  </span>
                  {s.room ? ` · ${s.room}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <DayBadges days={s.daysOfWeek} />
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.synced ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  }`}
                  title={s.synced ? "Synced to Google Calendar" : "Not synced"}
                >
                  {s.synced ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" strokeWidth={3.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : null}
                  {s.synced ? "synced" : "unsynced"}
                </span>
                <Button variant="secondary" onClick={() => startEdit(s)} aria-label={`Edit ${s.courseName}`}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => setDeleting(s)} aria-label={`Delete ${s.courseName}`}>
                  Delete
                </Button>
              </div>
            </div>
          )
        )}
      </div>

      <ConfirmModal
        open={deleting !== null}
        title="Delete this class?"
        body={
          deleting
            ? `"${deleting.courseName}" will be removed from your schedule and from Google Calendar. This can't be undone.`
            : ""
        }
        confirmLabel="Delete class"
        danger
        busy={busy}
        onConfirm={() => deleting && void remove(deleting)}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmModal
        open={deletingAll}
        title="Delete all classes?"
        body={`All ${schedules.length} class${schedules.length !== 1 ? "es" : ""} will be removed from your schedule and from Google Calendar. This can't be undone.`}
        confirmLabel="Delete all classes"
        danger
        busy={busy}
        onConfirm={() => void removeAll()}
        onCancel={() => setDeletingAll(false)}
      />
    </Card>
  );
}