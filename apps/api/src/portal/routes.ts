import express, { type Request, type Response } from "express";
import multer from "multer";
import { DomainError } from "procure-db";
import type { AppDeps } from "../deps";
import { verifyInvitationToken } from "../lib/magicLink";
import { declineInvitation, submitQuote } from "../services/submitQuote";
import { loadPortalContext, portalBlocker, type PortalContext } from "./context";
import { parseQuoteForm } from "./form";
import { messagePage, quoteFormPage, quoteReceivedPage } from "./views";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 200 },
}).single("document");

const stringFields = (body: unknown): Record<string, string> =>
  Object.fromEntries(
    Object.entries((body ?? {}) as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

function send(res: Response, status: number, body: string) {
  res.status(status).type("html").send(body);
}

async function resolve(deps: AppDeps, req: Request, res: Response): Promise<{ token: string; context: PortalContext } | null> {
  const token = String(req.params.token);
  const check = await verifyInvitationToken(deps.config.jwtSecret, token);
  if (!check.ok) {
    const expired = check.reason === "expired";
    send(
      res,
      expired ? 410 : 401,
      messagePage(
        expired ? "This link has expired" : "This link is not valid",
        expired
          ? "The quotation window has closed. Contact the buyer if you still want to quote."
          : "Check that you copied the whole link from the email.",
      ),
    );
    return null;
  }
  const context = await loadPortalContext(deps.pool, check.invitationId);
  if (!context) {
    send(res, 404, messagePage("Request not found", "This request no longer exists."));
    return null;
  }
  return { token, context };
}

export function portalRouter(deps: AppDeps) {
  const router = express.Router();

  router.use((_req, res, next) => {
    // The token is in the path: keep it out of caches and outbound Referer headers.
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    next();
  });

  router.get("/:token", async (req, res) => {
    const resolved = await resolve(deps, req, res);
    if (!resolved) return;
    const { token, context } = resolved;
    if (context.quote) return send(res, 200, quoteReceivedPage(context, context.quote));
    const blocker = portalBlocker(context);
    if (blocker) return send(res, 200, messagePage(blocker.title, blocker.message, context));
    send(res, 200, quoteFormPage(context, token));
  });

  router.post("/:token/submit", (req, res, next) => {
    upload(req, res, (uploadError: unknown) => {
      void (async () => {
        const resolved = await resolve(deps, req, res);
        if (!resolved) return;
        const { token, context } = resolved;
        if (uploadError) {
          const message =
            uploadError instanceof multer.MulterError && uploadError.code === "LIMIT_FILE_SIZE"
              ? "That document is larger than 10 MB."
              : "The upload could not be read. Please try again.";
          return send(res, 400, quoteFormPage(context, token, { values: stringFields(req.body), banner: message }));
        }
        const parsed = parseQuoteForm(req.body ?? {}, context.lines);
        if (!parsed.ok) {
          return send(res, 400, quoteFormPage(context, token, { ...parsed, banner: "Please fix the highlighted fields." }));
        }
        try {
          await submitQuote(deps, context.invitation.id, parsed.value, req.file && {
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
          });
        } catch (error) {
          if (!(error instanceof DomainError)) throw error;
          return send(res, error.status, quoteFormPage(context, token, { values: stringFields(req.body), banner: error.message }));
        }
        res.redirect(303, `/portal/${token}`);
      })().catch(next);
    });
  });

  router.post("/:token/decline", express.urlencoded({ extended: false }), async (req, res) => {
    const resolved = await resolve(deps, req, res);
    if (!resolved) return;
    const { token, context } = resolved;
    try {
      await declineInvitation(deps, context.invitation.id, String(req.body?.reason ?? ""));
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      return send(res, error.status, quoteFormPage(context, token, { banner: error.message }));
    }
    res.redirect(303, `/portal/${token}`);
  });

  return router;
}
