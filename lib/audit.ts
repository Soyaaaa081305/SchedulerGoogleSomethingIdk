import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function audit(userId: string, action: string, target?: string, meta?: Record<string, unknown>) {
  logger.info(`[audit] ${action}`, { userId, target, ...meta });
  try {
    await prisma.auditLog.create({ data: { userId, action, target: target ?? null, meta: meta ? JSON.stringify(meta) : null } });
  } catch (err) {
    logger.warn("[audit] failed to persist", { error: String(err) });
  }
}
