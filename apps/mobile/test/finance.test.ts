import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addExpense,
  initialFinance,
  validateExpenseInput,
  type FinanceSnapshot,
} from "../src/finance.ts";

function cloneFinance(): FinanceSnapshot {
  return structuredClone(initialFinance);
}

test("rejects partial streamed expense arguments before mutation", () => {
  const snapshot = cloneFinance();

  assert.deepEqual(
    validateExpenseInput(snapshot, {
      accountId: "card",
      merchant: "Souvla",
    }),
    { ok: false, reason: "Expense details are still streaming; nothing changed." },
  );
});

test("rejects invalid expense fields before mutation", () => {
  const snapshot = cloneFinance();

  for (const input of [
    {
      accountId: "card",
      merchant: "Souvla",
      category: "Food",
      amount: Number.NaN,
      currency: "USD",
    },
    {
      accountId: "card",
      merchant: "",
      category: "Food",
      amount: 9,
      currency: "USD",
    },
    {
      accountId: "card",
      merchant: "Souvla",
      category: "Food",
      amount: -9,
      currency: "USD",
    },
    {
      accountId: "card",
      merchant: "Souvla",
      category: "Food",
      amount: 9,
      currency: "AUD",
    },
    {
      accountId: "missing",
      merchant: "Souvla",
      category: "Food",
      amount: 9,
      currency: "USD",
    },
  ]) {
    const validated = validateExpenseInput(snapshot, input);
    assert.equal(validated.ok, false);
  }
});

test("complete approved expense input validates and mutates local finance state", () => {
  const snapshot = cloneFinance();
  const validated = validateExpenseInput(snapshot, {
    accountId: "card",
    merchant: "Souvla",
    category: "Food",
    amount: 9,
    currency: "USD",
  });

  assert.deepEqual(validated, {
    ok: true,
    value: {
      accountId: "card",
      merchant: "Souvla",
      category: "Food",
      amount: 9,
      currency: "USD",
    },
  });

  const result = addExpense(snapshot, validated.value);

  assert.equal(result.balance, -621.4);
  assert.equal(result.snapshot.accounts.find((account) => account.id === "card")?.balance, -621.4);
  assert.equal(result.snapshot.transactions[0].merchant, "Souvla");
  assert.equal(result.snapshot.transactions[0].amount, 9);
});

test("direct expense mutation rejects malformed unknown inputs", () => {
  const snapshot = cloneFinance();

  for (const input of [
    {
      accountId: "card",
      merchant: "Souvla",
    },
    {
      accountId: "card",
      merchant: "Souvla",
      category: "Food",
      amount: Number.NaN,
      currency: "USD",
    },
    {
      accountId: "card",
      merchant: "",
      category: "Food",
      amount: 9,
      currency: "USD",
    },
    {
      accountId: "card",
      merchant: "Souvla",
      category: "Food",
      amount: -9,
      currency: "USD",
    },
  ]) {
    const result = addExpense(snapshot, input);

    assert.equal(result.transaction, undefined);
    assert.equal(result.balance, undefined);
    assert.equal(result.snapshot, snapshot);
    assert.match(result.error, /nothing changed/);
  }
});

test("same-clock direct expense mutations produce unique transaction ids", () => {
  const snapshot = cloneFinance();
  const now = Date.now;
  Date.now = () => 1_800_000_000_000;

  try {
    const first = addExpense(snapshot, {
      accountId: "card",
      merchant: "Souvla",
      category: "Food",
      amount: 9,
      currency: "USD",
    });
    const second = addExpense(snapshot, {
      accountId: "card",
      merchant: "Blue Bottle",
      category: "Food",
      amount: 5,
      currency: "USD",
    });

    assert.ok(first.transaction);
    assert.ok(second.transaction);
    assert.notEqual(first.transaction.id, second.transaction.id);
  } finally {
    Date.now = now;
  }
});
