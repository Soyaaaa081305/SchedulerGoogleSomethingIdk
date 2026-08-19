"use client";

import { useState } from "react";
import Header, { type UserInfo } from "@/components/Header";
import BblCard from "@/components/BblCard";
import TaskList from "@/components/TaskList";
import type { TaskDTO } from "@/lib/types";

export default function TasksPage({
  user,
  initialTasks,
  connected,
}: {
  user: UserInfo;
  initialTasks: TaskDTO[];
  connected: boolean;
}) {
  const [tasks, setTasks] = useState<TaskDTO[]>(initialTasks);

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f7]">
      <Header user={user} connected={connected} />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 pb-16">
        <div>
          <h2 className="text-xl font-black text-zinc-900">
            Tasks &amp; Blackboard
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Paste assignments from Blackboard to auto-extract due dates, and
            track everything here. Tasks show up in your nightly 9:00 PM
            reminder.
          </p>
        </div>

        <BblCard onSaved={(t) => setTasks((prev) => [t, ...prev])} />
        <TaskList tasks={tasks} onChange={setTasks} />

        <footer className="border-t border-zinc-200 pt-4 text-center text-xs text-zinc-400">
          Scheduler — made for students of Mapúa Malayan Colleges Laguna. No more
          makakalimutin.
        </footer>
      </main>
    </div>
  );
}