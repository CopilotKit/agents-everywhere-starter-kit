export type CurrencyCode = "USD" | "EUR";

export type Account = {
  id: string;
  name: string;
  kind: "checking" | "credit" | "savings";
  currency: CurrencyCode;
  balance: number;
};

export type Budget = {
  id: string;
  category: string;
  limit: number;
  spent: number;
  currency: CurrencyCode;
};

export type Transaction = {
  id: string;
  accountId: string;
  merchant: string;
  category: string;
  amount: number;
  currency: CurrencyCode;
  date: string;
};

export type FinanceSnapshot = {
  accounts: Account[];
  budgets: Budget[];
  transactions: Transaction[];
};

export type ExpenseInput = {
  accountId: string;
  merchant: string;
  category: string;
  amount: number;
  currency: CurrencyCode;
};

export type ExpenseInputValidation =
  | { ok: true; value: ExpenseInput }
  | { ok: false; reason: string };

export type AddExpenseResult =
  | {
      snapshot: FinanceSnapshot;
      transaction: Transaction;
      balance: number;
      error?: never;
    }
  | {
      snapshot: FinanceSnapshot;
      transaction?: undefined;
      balance?: undefined;
      error: string;
    };

export const initialFinance: FinanceSnapshot = {
  accounts: [
    {
      id: "checking",
      name: "Everyday Checking",
      kind: "checking",
      currency: "USD",
      balance: 2840.55,
    },
    {
      id: "card",
      name: "Rewards Card",
      kind: "credit",
      currency: "USD",
      balance: -612.4,
    },
    {
      id: "travel",
      name: "Travel Fund",
      kind: "savings",
      currency: "EUR",
      balance: 940,
    },
  ],
  budgets: [
    { id: "food", category: "Food", limit: 450, spent: 318.75, currency: "USD" },
    { id: "groceries", category: "Groceries", limit: 600, spent: 412.1, currency: "USD" },
    { id: "transport", category: "Transport", limit: 175, spent: 96.4, currency: "USD" },
  ],
  transactions: [
    {
      id: "txn-1004",
      accountId: "card",
      merchant: "Blue Bottle Coffee",
      category: "Food",
      amount: 12.5,
      currency: "USD",
      date: "Today",
    },
    {
      id: "txn-1003",
      accountId: "checking",
      merchant: "Whole Foods",
      category: "Groceries",
      amount: 86.2,
      currency: "USD",
      date: "Yesterday",
    },
    {
      id: "txn-1002",
      accountId: "travel",
      merchant: "Trenitalia",
      category: "Transport",
      amount: 34,
      currency: "EUR",
      date: "2 days ago",
    },
  ],
};

const symbols: Record<CurrencyCode, string> = { USD: "$", EUR: "€" };

export function formatMoney(amount: number, currency: CurrencyCode) {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${symbols[currency]}${Math.abs(amount).toFixed(2)}`;
}

export function summarizeSpending(snapshot: FinanceSnapshot) {
  const totals = new Map<string, { category: string; currency: CurrencyCode; spent: number }>();
  for (const transaction of snapshot.transactions) {
    const key = `${transaction.category}\u0000${transaction.currency}`;
    const current = totals.get(key);
    totals.set(key, {
      category: transaction.category,
      currency: transaction.currency,
      spent: (current?.spent ?? 0) + transaction.amount,
    });
  }
  return [...totals.values()]
    .sort((a, b) => b.spent - a.spent);
}

function hasField(input: Record<string, unknown>, key: keyof ExpenseInput) {
  return input[key] !== undefined && input[key] !== null;
}

export function validateExpenseInput(
  snapshot: FinanceSnapshot,
  input: unknown,
): ExpenseInputValidation {
  if (!input || typeof input !== "object") {
    return { ok: false, reason: "Expense details are still streaming; nothing changed." };
  }

  const draft = input as Record<string, unknown>;
  const required: (keyof ExpenseInput)[] = [
    "accountId",
    "merchant",
    "category",
    "amount",
    "currency",
  ];
  if (required.some((key) => !hasField(draft, key))) {
    return { ok: false, reason: "Expense details are still streaming; nothing changed." };
  }

  if (
    typeof draft.accountId !== "string" ||
    typeof draft.merchant !== "string" ||
    typeof draft.category !== "string" ||
    typeof draft.amount !== "number" ||
    typeof draft.currency !== "string"
  ) {
    return { ok: false, reason: "Expense details are invalid; nothing changed." };
  }

  const accountId = draft.accountId.trim();
  const merchant = draft.merchant.trim();
  const category = draft.category.trim();
  const amount = draft.amount;
  const currency = draft.currency;

  if (!accountId || !merchant || !category) {
    return { ok: false, reason: "Expense details are invalid; nothing changed." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reason: "Expense amount is invalid; nothing changed." };
  }
  if (currency !== "USD" && currency !== "EUR") {
    return { ok: false, reason: "Expense currency is invalid; nothing changed." };
  }
  const account = snapshot.accounts.find((account) => account.id === accountId);
  if (!account) {
    return { ok: false, reason: `No local account matched "${accountId}"; nothing changed.` };
  }
  if (account.currency !== currency) {
    return {
      ok: false,
      reason: `${account.name} uses ${account.currency}, not ${currency}; nothing changed.`,
    };
  }

  return {
    ok: true,
    value: { accountId, merchant, category, amount, currency },
  };
}

let lastTransactionTime = 0;
let transactionSequence = 0;

function nextTransactionId() {
  const now = Date.now();
  if (now === lastTransactionTime) {
    transactionSequence += 1;
  } else {
    lastTransactionTime = now;
    transactionSequence = 0;
  }
  return `txn-${now.toString(36)}-${transactionSequence.toString(36)}`;
}

export function addExpense(
  snapshot: FinanceSnapshot,
  input: unknown,
): AddExpenseResult {
  const validated = validateExpenseInput(snapshot, input);
  if (!validated.ok) {
    return { snapshot, error: validated.reason };
  }

  const expense = validated.value;
  const account = snapshot.accounts.find((item) => item.id === expense.accountId)!;

  const transaction: Transaction = {
    ...expense,
    id: nextTransactionId(),
    date: "Just now",
  };
  const balance = account.balance - expense.amount;
  return {
    transaction,
    balance,
    snapshot: {
      accounts: snapshot.accounts.map((account) => {
        if (account.id !== expense.accountId) return account;
        return { ...account, balance };
      }),
      budgets: snapshot.budgets.map((budget) =>
        budget.category.toLowerCase() === expense.category.toLowerCase() &&
        budget.currency === expense.currency
          ? { ...budget, spent: budget.spent + expense.amount }
          : budget,
      ),
      transactions: [transaction, ...snapshot.transactions].slice(0, 12),
    },
  };
}
