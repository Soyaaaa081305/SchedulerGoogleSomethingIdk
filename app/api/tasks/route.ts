import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, handleError, ApiError } from "@/lib/api";
import { taskCreateSchema } from "@/lib/validators";
import { toTaskDTO } from "@/lib/types";

export async function GET() {
  try {
    const userId = await requireUser();
    const tasks = await prisma.task.findMany({
      where: { userId },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ tasks: tasks.map(toTaskDTO) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUser();
    const body = await req.json();
    const parsed = taskCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "Task title is required");
    }

    const task = await prisma.task.create({
      data: {
        userId,
        title: parsed.data.title,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        source: parsed.data.source,
      },
    });

    return NextResponse.json({ task: toTaskDTO(task) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}