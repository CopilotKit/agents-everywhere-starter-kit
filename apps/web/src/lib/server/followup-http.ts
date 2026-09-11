import { FollowupError } from "./followup-error";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { FollowupService } from "./followups";
import type { Workplace } from "./workplace";
const cookieName = "web-followup-session";
const command = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("propose"),
      incidentId: z.string(),
      title: z.string(),
      details: z.string(),
    })
    .strict(),
  z.object({ operation: z.literal("approve"), proposalId: z.uuid() }).strict(),
  z.object({ operation: z.literal("deny"), proposalId: z.uuid() }).strict(),
]);
const setup =
  "Set AMBIGUOUS_API_KEY in root .env and restart the web app. Select sample incidents now; saving and retrieval require a real Ambiguous workspace.";

async function closeConnection(connection: { close(): Promise<void> }) {
  try {
    await connection.close();
  } catch {
    // Keep cleanup non-masking: the request response is already determined, and
    // provider close errors can contain transport or credential details.
    console.warn("Ambiguous workplace cleanup failed after response handling.");
  }
}

export function createFollowupHandler(options: {
  connect(): { workplace: Workplace; close(): Promise<void> } | undefined;
  directory: string;
}) {
  return async (request: Request) => {
    const url = new URL(request.url);
    // Next may normalize request.url to localhost. Compare Origin with the actual HTTP Host.
    const expectedOrigin = new URL(url);
    expectedOrigin.host = request.headers.get("host") || url.host;
    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    const hasSession = !!cookie && /^[a-f0-9]{64}$/.test(cookie);
    const session = hasSession ? cookie : randomBytes(32).toString("hex");
    const reply = (value: unknown, status = 200) =>
      Response.json(value, {
        status,
        headers: {
          "Cache-Control": "no-store",
          ...(!hasSession
            ? {
                "Set-Cookie": `${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/api/followups; Max-Age=86400${url.protocol === "https:" ? "; Secure" : ""}`,
              }
            : {}),
        },
      });
    // A matching arbitrary Host/Origin can be DNS rebinding against a local credential.
    // Deployment must add authenticated users and a deliberate trusted-origin allowlist.
    if (
      !["localhost", "127.0.0.1", "[::1]"].includes(expectedOrigin.hostname)
    ) {
      return Response.json(
        { error: "This demo accepts loopback hosts only." },
        { status: 403 },
      );
    }
    if (request.method !== "GET" && request.method !== "POST")
      return reply({ error: "Method not allowed." }, 405);
    if (
      request.method === "POST" &&
      (request.headers.get("origin") !== expectedOrigin.origin ||
        !request.headers.get("content-type")?.startsWith("application/json"))
    ) {
      return reply(
        { error: "Use the approval controls from this app's own page." },
        403,
      );
    }
    if (request.method === "POST" && !hasSession)
      return reply(
        {
          error:
            "Reload the page to start a browser session before proposing or approving.",
        },
        403,
      );
    if (request.method === "GET" && url.searchParams.get("session") === "1")
      return reply({ status: "ready" });
    let connection: ReturnType<typeof options.connect> = undefined;
    const withCleanup = async (response: Response) => {
      if (connection) await closeConnection(connection);
      return response;
    };
    try {
      connection = options.connect();
      if (!connection)
        return await withCleanup(
          reply(
            request.method === "GET"
              ? { status: "unconfigured", message: setup }
              : { error: setup },
            request.method === "GET" ? 200 : 503,
          ),
        );
      const service = new FollowupService(
        connection.workplace,
        options.directory,
      );
      if (request.method === "GET") {
        const id = url.searchParams.get("taskId");
        if (id) return await withCleanup(reply({ task: await service.get(id) }));
        const identity = await connection.workplace.identity();
        return await withCleanup(
          reply({
            status: "connected",
            workspaceId: identity.workspaceId,
            identityName: identity.name,
            tasks: await service.list(
              url.searchParams.get("incidentId") ?? "INC-1042",
            ),
          }),
        );
      }
      const text = await request.text();
      if (text.length > 12_000)
        return await withCleanup(
          reply({ error: "The proposal is too large." }, 413),
        );
      const input = command.parse(JSON.parse(text));
      switch (input.operation) {
        case "propose": {
          const { operation: _operation, ...draft } = input;
          return await withCleanup(
            reply({ proposal: await service.propose(session, draft) }),
          );
        }
        case "deny":
          await service.deny(session, input.proposalId);
          return await withCleanup(reply({ status: "declined" }));
        case "approve":
          return await withCleanup(
            reply({
              task: await service.approve(session, input.proposalId),
            }),
          );
      }
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError)
        return await withCleanup(
          reply(
            {
              error:
                "Invalid request or provider data. Check the incident, title, details, and record ID.",
            },
            400,
          ),
        );
      // Only our controlled domain messages are safe to expose. Transport errors can contain credentials.
      const message =
        error instanceof FollowupError
          ? error.message
          : "Unable to reach Ambiguous or the approval store. Check the server configuration, credentials, permissions, and persistent disk, then refresh.";
      return await withCleanup(reply({ error: message }, 502));
    }
  };
}
