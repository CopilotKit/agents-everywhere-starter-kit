import assert from "node:assert/strict";
import { test } from "node:test";
import {
  initialFinance,
  summarizeSpending,
  type FinanceSnapshot,
} from "../src/finance.ts";

test("preserves the initial EUR transaction currency in spending summaries", () => {
  assert.deepEqual(
    summarizeSpending(initialFinance).find(
      (summary) => summary.category === "Transport",
    ),
    { category: "Transport", currency: "EUR", spent: 34 },
  );
});

test("keeps same-category spending in different currencies as distinct totals", () => {
  const snapshot: FinanceSnapshot = {
    ...initialFinance,
    transactions: [
      {
        id: "txn-usd-food",
        accountId: "card",
        merchant: "Souvla",
        category: "Food",
        amount: 9,
        currency: "USD",
        date: "Today",
      },
      {
        id: "txn-eur-food",
        accountId: "travel",
        merchant: "Mercato Centrale",
        category: "Food",
        amount: 11,
        currency: "EUR",
        date: "Today",
      },
      ...initialFinance.transactions,
    ],
  };

  assert.deepEqual(
    summarizeSpending(snapshot).filter((summary) => summary.category === "Food"),
    [
      { category: "Food", currency: "USD", spent: 21.5 },
      { category: "Food", currency: "EUR", spent: 11 },
    ],
  );
});
