import { auth } from "@/auth";
import SignIn from "@/components/SignIn";
import TasksPage from "@/components/TasksPage";
import { prisma } from "@/lib/prisma";
import { getCalendarStatus } from "@/lib/api";
import { toTaskDTO } from "@/lib/types";

export default async function Tasks() {
  const session = await auth();
  if (!session?.user) {
    return <SignIn />;
  }

  const userId = session.user.id;
  const [tasks, cal] = await Promise.all([
    prisma.task.findMany({
      where: { userId },
      orderBy: [{ completed: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    }),
    getCalendarStatus(userId),
  ]);

  return (
    <TasksPage
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
      }}
      initialTasks={tasks.map(toTaskDTO)}
      connected={cal.connected}
    />
  );
}