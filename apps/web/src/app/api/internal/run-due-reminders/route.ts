import { getTelegramConfig } from "@/lib/telegram/config";
import { getCronSecret, runAcordateScheduler } from "@/lib/acordate/scheduler";
import { AcordateSupabaseStore, getSupabaseConfig } from "@/lib/acordate/supabase";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cronSecret = getCronSecret();
  const authorization = request.headers.get("authorization");
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized scheduler." }, { status: 401 });
  }

  const telegram = getTelegramConfig();
  const supabase = getSupabaseConfig();
  if (!telegram || !supabase) {
    return Response.json(
      { error: "Scheduler is not configured on this server." },
      { status: 503 },
    );
  }

  try {
    const result = await runAcordateScheduler({
      store: new AcordateSupabaseStore(supabase),
      telegram,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error("Acordate scheduler failed", error);
    return Response.json({ error: "Scheduler processing failed." }, { status: 500 });
  }
}
