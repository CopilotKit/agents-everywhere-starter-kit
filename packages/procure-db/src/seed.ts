import type pg from "pg";
import { withTransaction } from "./pool";

// Sample data for local demos. Fixed UUIDs keep the seed idempotent and let a
// re-run update rows in place. Supplier emails use example.com; run Mailpit
// (docker compose) to see the messages.

export const WEB_REQUESTER_ID = "web:demo";

const items = [
  ["OFF-PEN-BLK", "Ballpoint pen, black", "Retractable ballpoint pen, medium point, black ink", "office_supplies", "each"],
  ["OFF-PEN-BLU", "Ballpoint pen, blue", "Retractable ballpoint pen, medium point, blue ink", "office_supplies", "each"],
  ["OFF-GEL-BLK", "Gel pen, black 0.7mm", "Gel ink rollerball pen, 0.7 mm, black", "office_supplies", "each"],
  ["OFF-PAP-A4", "Copy paper, A4 80gsm", "Multipurpose copy paper, ream of 500 sheets", "office_supplies", "ream"],
  ["OFF-NTB-A5", "Spiral notebook, A5 ruled", "80-sheet ruled spiral notebook", "office_supplies", "each"],
  ["OFF-STK-3X3", "Sticky notes, 3x3in yellow", "Pad of 100 repositionable notes", "office_supplies", "pad"],
  ["OFF-HLT-YEL", "Highlighter, yellow", "Chisel-tip fluorescent highlighter", "office_supplies", "each"],
  ["OFF-STP-STD", "Desktop stapler", "Full-strip stapler, 20-sheet capacity", "office_supplies", "each"],
  ["IT-MSE-USB", "USB optical mouse", "Wired three-button optical mouse", "it_equipment", "each"],
  ["IT-KBD-USB", "USB keyboard, US layout", "Wired full-size keyboard", "it_equipment", "each"],
  ["IT-HDM-2M", "HDMI cable, 2 m", "High-speed HDMI 2.0 cable", "it_equipment", "each"],
  ["IT-MON-24", "24-inch monitor, 1080p", "24-inch IPS monitor with HDMI and DisplayPort", "it_equipment", "each"],
  ["FAC-TWL-PPR", "Paper towels, multifold", "Case of 16 packs, 250 towels each", "facilities", "case"],
  ["FAC-SAN-500", "Hand sanitizer, 500 ml", "Pump bottle, 70% alcohol gel", "facilities", "bottle"],
  ["FAC-TRB-45L", "Trash bags, 45 L", "Box of 50 drawstring bags", "facilities", "box"],
] as const;

const suppliers = [
  ["5a1e0000-0000-4000-8000-000000000001", "Northwind Office Supply", "orders@northwind.example.com", [["office_supplies", true], ["facilities", false]]],
  ["5a1e0000-0000-4000-8000-000000000002", "Acme Stationers", "quotes@acme-stationers.example.com", [["office_supplies", true]]],
  ["5a1e0000-0000-4000-8000-000000000003", "Brightline Business Products", "sales@brightline.example.com", [["office_supplies", false], ["it_equipment", false]]],
  ["5a1e0000-0000-4000-8000-000000000004", "Contoso Tech Distribution", "rfq@contoso-tech.example.com", [["it_equipment", true]]],
  ["5a1e0000-0000-4000-8000-000000000005", "Harbor Facility Supplies", "bids@harbor-facility.example.com", [["facilities", true], ["office_supplies", false]]],
  ["5a1e0000-0000-4000-8000-000000000006", "Summit Janitorial", "hello@summit-janitorial.example.com", [["facilities", false]]],
] as const;

// Approval tiers come from migration 0008 (the "default" policy).
const approvers = [
  ["a9900000-0000-4000-8000-000000000001", "approver"],
  ["a9900000-0000-4000-8000-000000000002", "finance_lead"],
  ["a9900000-0000-4000-8000-000000000003", "owner"],
] as const;

export async function seed(pool: pg.Pool): Promise<void> {
  await withTransaction(pool, async (client) => {
    for (const [sku, name, description, category, unit] of items) {
      await client.query(
        `INSERT INTO items (sku, name, description, category, unit_of_measure)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (sku) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
           category = EXCLUDED.category, unit_of_measure = EXCLUDED.unit_of_measure, updated_at = now()`,
        [sku, name, description, category, unit],
      );
    }
    for (const [id, name, email, categories] of suppliers) {
      await client.query(
        `INSERT INTO suppliers (id, name, contact_info) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, contact_info = EXCLUDED.contact_info`,
        [id, name, { email }],
      );
      for (const [category, preferred] of categories) {
        await client.query(
          `INSERT INTO supplier_categories (supplier_id, category, preferred) VALUES ($1, $2, $3)
           ON CONFLICT (supplier_id, category) DO UPDATE SET preferred = EXCLUDED.preferred`,
          [id, category, preferred],
        );
      }
    }
    for (const [id, role] of approvers) {
      await client.query(
        `INSERT INTO approvers (id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
        [id, WEB_REQUESTER_ID, role],
      );
    }
  });
}
