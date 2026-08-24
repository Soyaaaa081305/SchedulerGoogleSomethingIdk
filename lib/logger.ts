type Level = "debug" | "info" | "warn" | "error";

const isProd = process.env.NODE_ENV === "production";

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  const entry = { level, msg, ...meta, ts: new Date().toISOString() };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else if (!isProd) console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
