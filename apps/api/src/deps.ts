import type pg from "pg";
import type { ApiConfig } from "./config";
import type { Mailer } from "./lib/mailer";
import type { RunQueue } from "./lib/queue";

export interface AppDeps {
  pool: pg.Pool;
  config: Pick<ApiConfig, "jwtSecret" | "portalBaseUrl" | "uploadsDir">;
  mailer: Mailer;
  queue: RunQueue;
  /** Local calendar date, YYYY-MM-DD. Injected so tests can pin it. */
  today: () => string;
  log: (message: string, error?: unknown) => void;
}

export const localToday = () => new Date().toLocaleDateString("en-CA");
