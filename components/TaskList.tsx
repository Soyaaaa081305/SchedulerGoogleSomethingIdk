"use client";

import { useMemo, useState } from "react";
import { Card, Button, ErrorBanner } from "@/components/ui";
import type { TaskDTO } from "@/lib/types";

function todayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function TaskList({
  tasks,
  onChange,
}: {
  tasks: TaskDTO[];
  onChange: (tasks: TaskDTO[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const today = todayStr();

  const { open, done } = useMemo(() => {
    const openTasks = tasks.filter((t) => !t.completed);
    const doneTasks = tasks.filter((t) => t.completed);

    const overdue: TaskDTO[] = [];
    const dueToday: TaskDTO[] = [];
    const upcoming: TaskDTO[] = [];
    const noDate: TaskDTO[] = [];

    for (const t of openTasks) {
      if (!t.dueDate) {
        noDate.push(t);
      } else {
        const d = t.dueDate.slice(0, 10);
        if (d < today) overdue.push(t);
        else if (d === today) dueToday.push(t);
        else upcoming.push(t);
      }
    }

    const byDate = (a: TaskDTO, b: TaskDTO) =>
      (a.dueDate ?? "").localeCompare(b.dueDate ?? "");

    return {
      open: [...overdue.sort(byDate), ...dueToday.sort(byDate), ...upcoming.sort(byDate), ...noDate],
      done: doneTasks.sort(byDate),
    };
  }, [tasks, today]);

  const toggle = async (t: TaskDTO) => {
    try {
      const res = await fetch(`/api/tasks/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !t.completed }),
      });
      const data = (await res.json()) as { task?: TaskDTO };
      if (!res.ok) return;
      onChange(tasks.map((x) => (x.id === t.id ? data.task! : x)));
    } catch {
      /* ignore */
    }
  };

  const remove = async (t: TaskDTO) => {
    if (!window.confirm(`Delete task "${t.title}"?`)) return;
    try {
      const res = await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
      if (!res.ok) return;
      onChange(tasks.filter((x) => x.id !== t.id));
    } catch {
      /* ignore */
    }
  };

  const add = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          dueDate: dueDate ? `${dueDate}T23:59:59+08:00` : null,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        task?: TaskDTO;
        error?: string;
      } | null;
      if (!res.ok) throw new Error(data?.error ?? "Could not add task");
      onChange([data!.task!, ...tasks]);
      setTitle("");
      setDueDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add task");
    }
  };

  const dueLabel = (dueDate: string | null): { label: string; cls: string } => {
    if (!dueDate) return { label: "No due date", cls: "text-zinc-400" };
    const d = dueDate.slice(0, 10);
    if (d < today) return { label: `Overdue · ${d}`, cls: "text-red-600" };
    if (d === today) return { label: "Due today", cls: "text-amber-600" };
    return { label: d, cls: "text-zinc-500" };
  };

  const renderTask = (t: TaskDTO, completed: boolean) => {
    const due = dueLabel(t.dueDate);
    return (
      <li
        key={t.id}
        className={`flex items-start gap-3 rounded-xl border border-zinc-200 p-3 ${
          completed ? "opacity-60" : ""
        }`}
      >
        <input
          type="checkbox"
          checked={completed}
          onChange={() => void toggle(t)}
          className="mt-1 h-4 w-4 accent-[#c8102e]"
          aria-label={`Mark ${t.title} as ${completed ? "incomplete" : "complete"}`}
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium text-zinc-900 ${completed ? "line-through" : ""}`}>
            {t.title}
          </p>
          <p className={`text-xs ${due.cls}`}>
            {due.label}
            {t.source === "bbl" ? " · from BBL" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void remove(t)}
          className="text-xs font-medium text-[#8a0a1e] hover:underline"
          aria-label={`Delete ${t.title}`}
        >
          Delete
        </button>
      </li>
    );
  };

  return (
    <Card title="Tasks & due dates">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void add()}
          placeholder="Add a task…"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-[#c8102e] focus:outline-none"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-[#c8102e] focus:outline-none"
          aria-label="Due date"
        />
        <Button onClick={() => void add()}>Add</Button>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {open.length === 0 && done.length === 0 && (
        <p className="text-sm text-zinc-500">
          No tasks yet. Add one above, or paste your Blackboard assignments in
          the card below.
        </p>
      )}

      {open.length > 0 && (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            To do
          </h3>
          <ul className="mb-4 space-y-2">{open.map((t) => renderTask(t, false))}</ul>
        </>
      )}

      {done.length > 0 && (
        <>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Done
          </h3>
          <ul className="space-y-2">{done.map((t) => renderTask(t, true))}</ul>
        </>
      )}
    </Card>
  );
}