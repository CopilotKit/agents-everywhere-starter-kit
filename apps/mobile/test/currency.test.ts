import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { addExpense, initialFinance, validateExpenseInput } from "../src/finance.ts";

describe("expense currency guard", () => {
  test("rejects an expense when the account currency does not match", () => {
    const result = addExpense(initialFinance, {
      accountId: "card",
      merchant: "Cafe",
      category: "Food",
      amount: 9,
      currency: "EUR",
    });

    assert.deepEqual(result.snapshot, initialFinance);
    assert.equal(result.transaction, undefined);
    assert.equal(result.balance, undefined);
    assert.equal(result.error, "Rewards Card uses USD, not EUR; nothing changed.");
  });

  test("rejects mismatched currency during approval validation", () => {
    assert.deepEqual(
      validateExpenseInput(initialFinance, {
        accountId: "card",
        merchant: "Cafe",
        category: "Food",
        amount: 9,
        currency: "EUR",
      }),
      { ok: false, reason: "Rewards Card uses USD, not EUR; nothing changed." },
    );
  });

  test("applies an expense when the account currency matches", () => {
    const result = addExpense(initialFinance, {
      accountId: "card",
      merchant: "Souvla",
      category: "Food",
      amount: 9,
      currency: "USD",
    });

    const account = result.snapshot.accounts.find((item) => item.id === "card");
    const budget = result.snapshot.budgets.find((item) => item.id === "food");

    assert.equal(result.transaction?.merchant, "Souvla");
    assert.equal(result.balance, -621.4);
    assert.equal(account?.balance, -621.4);
    assert.equal(budget?.spent, 327.75);
    assert.equal(result.snapshot.transactions[0], result.transaction);
  });
});
