import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { LogEntry } from "@/lib/types";

declare global {
  // eslint-disable-next-line no-var
  var __ourHomeLogs: LogEntry[] | undefined;
}

const MAX_LOGS = 300;
const store = globalThis.__ourHomeLogs ?? [];
globalThis.__ourHomeLogs = store;

export async function writeLog(
  level: LogEntry["level"],
  event: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    event,
    message,
    meta,
  };

  store.unshift(entry);
  if (store.length > MAX_LOGS) store.length = MAX_LOGS;

  const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  consoleMethod(`[ourhome:${event}] ${message}`, meta ?? "");

  // Local development convenience only. Serverless filesystems are not durable.
  if (process.env.NODE_ENV !== "production") {
    try {
      const logDir = path.join(process.cwd(), "logs");
      await mkdir(logDir, { recursive: true });
      await appendFile(path.join(logDir, "dev-events.ndjson"), `${JSON.stringify(entry)}\n`, "utf8");
    } catch {
      // In-memory logging remains available even if the filesystem is read-only.
    }
  }

  return entry;
}

export function readLogs(limit = 100) {
  return store.slice(0, Math.max(1, Math.min(limit, MAX_LOGS)));
}
