import { Queue } from "bullmq";
import { Redis } from "ioredis";

/**
 * Background runs for the agent side. Only `quote_submitted` is produced today;
 * nothing consumes it yet (the Slack surface will).
 */
export interface RunQueue {
  enqueueQuoteSubmitted(quoteId: string, jobId: string): Promise<void>;
  close(): Promise<void>;
}

export function createRunQueue(redisUrl: string): RunQueue {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue("runs", { connection });
  return {
    async enqueueQuoteSubmitted(quoteId, jobId) {
      await queue.add(
        "quote_submitted",
        { quoteId },
        {
          jobId,
          attempts: 4,
          backoff: { type: "exponential", delay: 2_000 },
          removeOnComplete: 1_000,
          removeOnFail: 5_000,
        },
      );
    },
    async close() {
      await queue.close();
      await connection.quit();
    },
  };
}
