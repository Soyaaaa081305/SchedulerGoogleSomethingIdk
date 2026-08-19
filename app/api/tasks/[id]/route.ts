import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { taskUpdateSchema } from "@/lib/validators";
import { toTaskDTO } from "@/lib/types";

async function getOwnedTask(id: string, userId: string) {
  const task = await prisma.task.findFirst({ where: { id, userId } });
  if (!task) throw new ApiError(404, "Task not found");
  return task;
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  try {
    const userId = await requireUser();
    const { id } = await ctx.params;
    await getOwnedTask(id, userId);

    const body = await req.json();
    const parsed = taskUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Invalid task data");
    }

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.dueDate !== undefined
          ? { dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null }
          : {}),
        ...(parsed.data.completed !== undefined ? { completed: parsed.data.completed } : {}),
      },
    });

    return NextResponse.json({ task: toTaskDTO(task) });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tasks/[id]">) {
  try {
    const userId = await requireUser();
    const { id } = await ctx.params;
    await getOwnedTask(id, userId);
    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}