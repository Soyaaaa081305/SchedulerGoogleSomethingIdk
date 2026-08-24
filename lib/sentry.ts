import { logger } from "@/lib/logger";

// No-op until you run: npm i @sentry/nextjs && set SENTRY_DSN
// Then uncomment the dynamic imports below.

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

export function captureException(err: unknown, ctx?: Record<string, unknown>) {
  logger.error("[sentry] captureException", { error: String(err), ...ctx, dsn: dsn ? "set" : "not set" });
  if (!dsn) return;
  // Uncomment after installing @sentry/nextjs:
  // import("@sentry/nextjs").then((Sentry) => Sentry.captureException(err, { extra: ctx })).catch(() => {});
}

export function captureMessage(msg: string, level: "info" | "warning" | "error" = "info") {
  logger.info(`[sentry] ${level}: ${msg}`, { dsn: dsn ? "set" : "not set" });
  if (!dsn) return;
  // Uncomment after installing @sentry/nextjs:
  // import("@sentry/nextjs").then((Sentry) => Sentry.captureMessage(msg, level)).catch(() => {});
}

export function initSentry() {
  if (!dsn) return;
  // Uncomment after installing @sentry/nextjs:
  // import("@sentry/nextjs").then((Sentry) => Sentry.init({ dsn, tracesSampleRate: 0.1, environment: process.env.NODE_ENV })).catch(() => {});
}
