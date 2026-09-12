# The procurement API contract

The Slack agent holds no domain state. Every read and write goes through one
interface — [`ProcurementApi`](../packages/agent-core/src/capabilities/procurement/client.ts) —
so the backend can be built independently of the agent, and the agent can be
built and demoed before the backend exists.

Two implementations ship:

| Implementation | When it is used |
|---|---|
| `httpProcurementApi` | `PROCUREMENT_API_URL` is set |
| `createFakeProcurementApi` | it is not — in-memory sample data |

Set the URL and the same tools hit the real service. Nothing else changes.

```dotenv
PROCUREMENT_API_URL=http://localhost:4000
PROCUREMENT_API_KEY=            # sent as `Authorization: Bearer <key>` when present
PROCUREMENT_API_TIMEOUT_MS=15000
```

## Endpoints

All bodies are JSON. Types are in
[`types.ts`](../packages/agent-core/src/capabilities/procurement/types.ts).

| Method | Path | Body / query | Returns |
|---|---|---|---|
| `GET` | `/catalog` | `?query=&limit=` | `CatalogItem[]` |
| `GET` | `/requisitions/by-code` | `?code=REQ-1042` | `Requisition` or 404 |
| `POST` | `/requisitions` | `{ requesterId, title?, threadRef? }` | `Requisition` |
| `POST` | `/requisitions/:id/items` | `{ requests: { text, quantity? }[] }` | `Requisition` |
| `PATCH` | `/requisitions/:id/lines/:lineId` | `{ itemId?, quantity? }` | `Requisition` |
| `GET` | `/requisitions/:id` | — | `RequisitionDetail` or 404 |
| `GET` | `/requisitions` | `?requesterId=&status=` | `Requisition[]` |
| `GET` | `/suppliers` | `?category=` | `Supplier[]` |
| `POST` | `/requisitions/:id/rfq` | `{ supplierIds? }` | `Rfq` |
| `POST` | `/requisitions/:id/rfq/resend` | — | `Rfq` |
| `GET` | `/requisitions/:id/comparison` | — | `Comparison` |
| `POST` | `/requisitions/:id/purchase-order` | `{ quoteId, approvedBy }` | `PurchaseOrder` |

A `404` is read as "not found" and returns `null` — it is not an error. Any
other non-2xx is surfaced to the agent as text, so **put a human-readable
sentence in `message` or `error`**: the model reads it and repairs from it.
Nothing else from the response body reaches the thread.

## Behaviour the agent relies on

These are not suggestions — the tools and their tests assume them.

**Item matching is the backend's job.** `POST /items` takes the requester's own
words. Return each line with a `status`:

- `confirmed` — a decisive match, settled.
- `needs_confirmation` — ambiguous. Include up to 3 `candidates`. The agent
  shows them and asks; it will not choose.
- `unmatched` — nothing plausible. The agent says so rather than inventing an item.

Only resolve to `confirmed` when you are genuinely sure. A wrong confident
match becomes a bulk order of the wrong thing.

**`PATCH` on a line with `itemId: null` drops that line.** That is the "none of
these" answer.

**`POST /rfq` must refuse (409) while any line is not `confirmed`**, and the
message should name the offending items. The agent relays the refusal and
confirms the lines instead of retrying.

**A failed invitation is data, not an error.** Return the `Rfq` with
`status: "failed"` and a human-readable `error` on that invitation. The agent
reports it and offers the resend.

**`GET /comparison` is recomputed per call, never cached.** A late quote must
change the recommendation. Only recommend a quote covering *every* confirmed
line — a cheaper partial quote is not cheaper, it is incomplete. List anything
no supplier quoted in `unquotedItemNames`; the agent warns before recommending.

**`POST /purchase-order` must be idempotent per requisition** and return 409 if
one already exists, naming it. This is the only write with money attached, and
a double click must not produce two orders.

## What the agent will never do

The Slack agent has no tool that issues a purchase order. `request_po_approval`
posts an approval card and returns; `POST /purchase-order` is called from the
button's click handler, outside the model's loop. So the backend can assume
every PO request was preceded by a human click, and `approvedBy` is that
clicker's platform user id.

## The thread binding

Channels' `Thread` exposes no stable conversation id, so the thread-to-
requisition binding lives in Channel thread state, not in the backend.
`threadRef` on `POST /requisitions` is optional traceability for your own
records.

That state is in-memory unless `createChannel({ store })` is given a durable
one, so a listener restart can orphan an open thread. The recovery path is
`GET /requisitions/by-code` — the requester names the code and the agent
re-binds. Configure a durable store before this matters in production.
