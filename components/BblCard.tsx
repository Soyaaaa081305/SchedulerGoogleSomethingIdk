"use client";

import { useState } from "react";
import { Card, Button, ErrorBanner, NoticeBanner, Spinner } from "@/components/ui";
import type { TaskDTO } from "@/lib/types";
import type { ParsedTask } from "@/lib/gemini";

interface PreviewRow extends ParsedTask {
  selected: boolean;
}

export default function BblCard({ onSaved }: { onSaved: (t: TaskDTO) => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const extract = async () => {
    if (text.trim().length < 3) {
      setError("Paste some assignment text from Blackboard first.");
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => null)) as {
        tasks?: ParsedTask[];
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "Could not extract tasks");
      const tasks = data?.tasks ?? [];
      if (tasks.length === 0) {
        setNotice("No tasks with due dates were found in that text.");
      } else {
        setRows(tasks.map((t) => ({ ...t, selected: true })));
        setNotice(`Found ${tasks.length} task${tasks.length > 1 ? "s" : ""}. Review and save below.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  };

  const saveSelected = async () => {
    const selected = rows.filter((r) => r.selected);
    if (selected.length === 0) return;
    setSaving(true);
    setError(null);
    const savedIds = new Set<string>();
    try {
      for (const row of selected) {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: row.title,
            dueDate: row.dueDate ? `${row.dueDate}T23:59:59+08:00` : null,
            source: "bbl" as const,
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          task?: TaskDTO;
          error?: string;
        } | null;
        if (!res.ok) throw new Error(data?.error ?? "Could not save task");
        savedIds.add(`${row.title}|${row.dueDate}`);
        onSaved(data!.task!);
      }
      setRows((prev) => prev.filter((r) => !savedIds.has(`${r.title}|${r.dueDate}`)));
      setNotice(`Saved ${savedIds.size} task${savedIds.size > 1 ? "s" : ""}. They'll appear in your nightly reminder.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save tasks");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Paste from Blackboard (BBL)">
      <p className="mb-3 text-sm text-zinc-500">
        Blackboard has no official student API, so paste your assignments page
        text here and the AI will pull out tasks and due dates for you.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Select your assignments on Blackboard, copy, and paste here…"
        className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-[#c8102e] focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={() => void extract()} disabled={loading}>
          Extract due dates
        </Button>
        {loading && <Spinner label="Analyzing…" />}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}
      {notice && !rows.length && (
        <div className="mt-4">
          <NoticeBanner message={notice} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4 space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3">
              <input
                type="checkbox"
                checked={row.selected}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, j) => (j === i ? { ...r, selected: e.target.checked } : r))
                  )
                }
                className="h-4 w-4 accent-[#c8102e]"
                aria-label={`Select ${row.title}`}
              />
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={row.title}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, title: e.target.value } : r))
                    )
                  }
                  className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
                />
                <input
                  type="date"
                  value={row.dueDate ?? ""}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, dueDate: e.target.value || null } : r))
                    )
                  }
                  className="mt-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900"
                />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void saveSelected()}
              disabled={saving || rows.every((r) => !r.selected)}
            >
              {saving ? "Saving…" : `Save ${rows.filter((r) => r.selected).length} selected`}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setRows([]);
                setNotice(null);
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