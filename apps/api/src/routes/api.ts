import express from "express";
import {
  compareQuotes,
  createDraftRequisition,
  DomainError,
  getItemDetail,
  getPurchaseOrder,
  getRequisitionDetail,
  getSupplierDetail,
  listCategories,
  listPurchaseOrders,
  listRequisitions,
  listSuppliers,
  searchItems,
  selectInvitees,
  WEB_REQUESTER_ID,
} from "procure-db";
import type { PoStatus, RequisitionStatus } from "procure-db/types";
import { z } from "zod";
import type { AppDeps } from "../deps";
import { dispatchRfq } from "../services/dispatchRfq";
import { issuePurchaseOrder } from "../services/issuePurchaseOrder";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(value: unknown, label = "id"): string {
  const text = String(value);
  if (!UUID.test(text)) throw new DomainError(`Invalid ${label}.`);
  return text;
}

const optional = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

function found<T>(value: T | null, what: string): T {
  if (value === null) throw new DomainError(`${what} not found.`, 404);
  return value;
}

const createRequisitionBody = z.object({
  neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  lines: z
    .array(z.object({ itemId: z.string().regex(UUID), quantity: z.number().positive(), rawDescription: z.string().min(1) }))
    .min(1),
});

const awardBody = z.object({ quoteId: z.string().regex(UUID) });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new DomainError(result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
  }
  return result.data;
}

export function apiRouter(deps: AppDeps) {
  const router = express.Router();
  const { pool } = deps;
  router.use(express.json({ limit: "100kb" }));

  router.get("/requisitions", async (req, res) => {
    res.json(await listRequisitions(pool, { status: optional(req.query.status) as RequisitionStatus | undefined }));
  });
  router.get("/requisitions/:id", async (req, res) => {
    res.json(found(await getRequisitionDetail(pool, uuid(req.params.id)), "Requisition"));
  });
  router.get("/requisitions/:id/rfq-preview", async (req, res) => {
    const requisition = found(await getRequisitionDetail(pool, uuid(req.params.id)), "Requisition");
    const categories = [...new Set(requisition.lines.map((line) => line.category).filter((c): c is string => !!c))];
    const invitees = new Map<string, { id: string; name: string; email: string | null; preferred: boolean }>();
    for (const category of categories) {
      for (const { id, name, email, preferred } of await selectInvitees(pool, category)) {
        invitees.set(id, { id, name, email, preferred });
      }
    }
    res.json({ requisition, invitees: [...invitees.values()] });
  });
  router.get("/requisitions/:id/comparison", async (req, res) => {
    res.json(found(await compareQuotes(pool, uuid(req.params.id), deps.today()), "Requisition"));
  });
  router.post("/requisitions", async (req, res) => {
    const body = parse(createRequisitionBody, req.body);
    res.status(201).json(await createDraftRequisition(pool, { requesterId: WEB_REQUESTER_ID, ...body }));
  });

  // External writes. The ERP only calls these after the requester clicks an
  // approval card; the agent has no tool that reaches them.
  router.post("/requisitions/:id/rfq", async (req, res) => {
    res.json(await dispatchRfq(deps, uuid(req.params.id)));
  });
  router.post("/requisitions/:id/award", async (req, res) => {
    const { quoteId } = parse(awardBody, req.body);
    res.json(
      await issuePurchaseOrder(deps, { requisitionId: uuid(req.params.id), quoteId, approvedBy: WEB_REQUESTER_ID }),
    );
  });

  router.get("/suppliers", async (req, res) => {
    res.json(await listSuppliers(pool, { category: optional(req.query.category) }));
  });
  router.get("/suppliers/:id", async (req, res) => {
    res.json(found(await getSupplierDetail(pool, uuid(req.params.id)), "Supplier"));
  });

  router.get("/items", async (req, res) => {
    res.json(await searchItems(pool, { query: optional(req.query.query), category: optional(req.query.category), limit: 200 }));
  });
  router.get("/items/:id", async (req, res) => {
    res.json(found(await getItemDetail(pool, uuid(req.params.id)), "Item"));
  });
  router.get("/categories", async (_req, res) => {
    res.json(await listCategories(pool));
  });

  router.get("/purchase-orders", async (req, res) => {
    res.json(await listPurchaseOrders(pool, { status: optional(req.query.status) as PoStatus | undefined }));
  });
  router.get("/purchase-orders/:id", async (req, res) => {
    res.json(found(await getPurchaseOrder(pool, uuid(req.params.id)), "Purchase order"));
  });

  router.use((_req, res) => {
    res.status(404).json({ error: "Not found." });
  });
  return router;
}
