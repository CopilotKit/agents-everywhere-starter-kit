import { closePool, getPool } from "../pool";
import { seed } from "../seed";

try {
  await seed(getPool());
  console.log("Seeded sample items, suppliers, and the web:demo approver.");
} finally {
  await closePool();
}
