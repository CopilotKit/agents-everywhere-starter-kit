import { randomBytes } from "node:crypto";
import pg from "pg";
import { migrate } from "./migrate";
import { seed } from "./seed";

export interface TestDatabase {
  pool: pg.Pool;
  url: string;
  drop: () => Promise<void>;
}

/** Creates a fresh migrated + seeded database next to DATABASE_URL's. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error("DATABASE_URL must be set for DB tests (npm run db:up).");
  const name = `procurebot_test_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: baseUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString() });
  await migrate(pool);
  await seed(pool);

  return {
    pool,
    url: url.toString(),
    drop: async () => {
      await pool.end();
      const cleanup = new pg.Client({ connectionString: baseUrl });
      await cleanup.connect();
      await cleanup.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await cleanup.end();
    },
  };
}
