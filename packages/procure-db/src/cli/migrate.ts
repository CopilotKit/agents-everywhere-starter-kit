import { migrate } from "../migrate";
import { closePool, getPool } from "../pool";

try {
  const applied = await migrate(getPool());
  console.log(applied.length ? `Applied ${applied.length} migration(s):\n  ${applied.join("\n  ")}` : "Schema is up to date.");
} finally {
  await closePool();
}
