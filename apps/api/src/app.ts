import express, { type ErrorRequestHandler } from "express";
import { DomainError } from "procure-db";
import type { AppDeps } from "./deps";
import { messagePage } from "./portal/views";
import { apiRouter } from "./routes/api";
import { portalRouter } from "./portal/routes";

export function createApp(deps: AppDeps) {
  const app = express();
  app.disable("x-powered-by");

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api", apiRouter(deps));
  app.use("/portal", portalRouter(deps));

  const onError: ErrorRequestHandler = (error, req, res, _next) => {
    const status = error instanceof DomainError ? error.status : 500;
    if (status === 500) deps.log(`${req.method} ${req.path} failed`, error);
    const message = status === 500 ? "Something went wrong on our side." : (error as Error).message;
    if (req.path.startsWith("/portal")) {
      res.status(status).type("html").send(messagePage(status === 500 ? "Something went wrong" : "Request failed", message));
    } else {
      res.status(status).json({ error: message });
    }
  };
  app.use(onError);
  return app;
}
