import pg from "pg";

// Keep DATE as 'YYYY-MM-DD' (the default parses it to a local-midnight Date),
// timestamps as ISO strings, and bigint aggregates (sums of cents) as numbers.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (value) => new Date(value).toISOString());
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export type Db = Pick<pg.Pool | pg.PoolClient, "query">;

let shared: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!shared) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Add it to the root .env (see .env.example).");
    }
    shared = new pg.Pool({ connectionString });
  }
  return shared;
}

export async function closePool(): Promise<void> {
  await shared?.end();
  shared = undefined;
}

export async function withTransaction<T>(
  pool: pg.Pool,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
