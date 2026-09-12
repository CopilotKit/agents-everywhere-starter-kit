import { researchBlocker } from "@/lib/research-blocker";
import type { Blocker } from "@/lib/graph-types";

export async function POST(request: Request) {
  const blocker = (await request.json()) as Blocker;
  if (!blocker?.id || !blocker?.label) {
    return Response.json({ error: "A blocker with id and label is required." }, { status: 400 });
  }
  const resolution = await researchBlocker(blocker);
  return Response.json({ resolution });
}
