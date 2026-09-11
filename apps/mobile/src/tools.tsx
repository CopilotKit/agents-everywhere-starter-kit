import type { Dispatch, SetStateAction } from "react";
import { Pressable, Text, View } from "react-native";
import {
  useAgentContext,
  useFrontendTool,
  useHumanInTheLoop,
} from "@copilotkit/react-native/headless";
import { z } from "zod";
import {
  addExpense,
  formatMoney,
  summarizeSpending,
  validateExpenseInput,
  type CurrencyCode,
  type FinanceSnapshot,
} from "@/finance";
import { styles } from "@/styles";

const currencySchema = z.enum(["USD", "EUR"]);

function accountName(snapshot: FinanceSnapshot, id: string) {
  return snapshot.accounts.find((account) => account.id === id)?.name ?? id;
}

export function Tools({
  finance,
  setFinance,
}: {
  finance: FinanceSnapshot;
  setFinance: Dispatch<SetStateAction<FinanceSnapshot>>;
}) {
  useAgentContext({
    description:
      "The visible React Native finance app state. This sample data is local to the phone template. Use mobile finance tools for answers; use add_mobile_expense for writes, which requires the user's approval tap before local state changes.",
    value: {
      surface: "react-native",
      accounts: finance.accounts,
      budgets: finance.budgets,
      recentTransactions: finance.transactions.slice(0, 5),
    },
  });

  useHumanInTheLoop({
    name: "add_mobile_expense",
    description:
      "Propose a new local expense in the React Native finance app. The user must approve the native card before the expense changes the local account balance and budget.",
    parameters: z.object({
      accountId: z.string().describe("The target account id from list_mobile_accounts."),
      merchant: z.string().describe("Merchant or payee name."),
      category: z.string().describe("Budget category for this expense."),
      amount: z.number().positive().describe("Expense amount in the given currency."),
      currency: currencySchema.describe("Currency code matching the account."),
    }),
    render: ({ args, respond, result }) => {
      if (!respond) {
        return (
          <View style={styles.gate}>
            <Text style={styles.gateDone}>{result ? String(result) : "Waiting..."}</Text>
          </View>
        );
      }
      const validated = validateExpenseInput(finance, args);
      const amount =
        typeof args.amount === "number" &&
        Number.isFinite(args.amount) &&
        (args.currency === "USD" || args.currency === "EUR")
          ? formatMoney(args.amount, args.currency as CurrencyCode)
          : "Pending amount";
      return (
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>Approve local expense</Text>
          <Text style={styles.gateBody}>
            {amount} at {args.merchant ?? "a merchant"} from{" "}
            {accountName(finance, String(args.accountId ?? ""))}.
          </Text>
          <Text style={styles.gateBody}>
            Category: {args.category ?? "Uncategorized"}. This changes only the sample
            phone state.
          </Text>
          {!validated.ok ? (
            <Text style={styles.gateBody}>{validated.reason}</Text>
          ) : null}
          <View style={styles.gateRow}>
            <Pressable
              style={[
                styles.btn,
                styles.btnPrimary,
                !validated.ok ? styles.btnDisabled : null,
              ]}
              disabled={!validated.ok}
              onPress={() => {
                const current = validateExpenseInput(finance, args);
                if (!current.ok) {
                  void respond(current.reason);
                  return;
                }
                const result = addExpense(
                  finance,
                  current.value,
                );
                if (!result.transaction) {
                  void respond(result.error);
                  return;
                }
                setFinance(result.snapshot);
                void respond(
                  `Approved and saved local expense ${result.transaction.id}. ${accountName(
                    result.snapshot,
                    current.value.accountId,
                  )} is now ${formatMoney(result.balance, current.value.currency)}.`,
                );
              }}
            >
              <Text
                style={[
                  styles.btnPrimaryText,
                  !validated.ok ? styles.btnDisabledText : null,
                ]}
              >
                Add expense
              </Text>
            </Pressable>
            <Pressable
              style={styles.btn}
              onPress={() =>
                void respond(
                  "The user declined the expense. Nothing changed in the local finance app.",
                )
              }
            >
              <Text style={styles.btnText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      );
    },
  });

  useFrontendTool({
    name: "list_mobile_accounts",
    description:
      "Read the local finance accounts and balances visible in the React Native app.",
    parameters: z.object({}),
    handler: async () => ({ accounts: finance.accounts }),
    render: () => (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Accounts</Text>
        {finance.accounts.map((account) => (
          <View key={account.id} style={styles.row}>
            <Text style={styles.rowLabel}>{account.name}</Text>
            <Text style={styles.rowValue}>{formatMoney(account.balance, account.currency)}</Text>
          </View>
        ))}
      </View>
    ),
  });

  useFrontendTool({
    name: "list_mobile_budgets",
    description: "Read local monthly budgets with spent and remaining amounts.",
    parameters: z.object({}),
    handler: async () => ({ budgets: finance.budgets }),
    render: () => (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Budgets</Text>
        {finance.budgets.map((budget) => {
          const pct = Math.min(100, Math.round((budget.spent / budget.limit) * 100));
          return (
            <View key={budget.id} style={styles.budgetRow}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{budget.category}</Text>
                <Text style={styles.rowValue}>
                  {formatMoney(budget.spent, budget.currency)} /{" "}
                  {formatMoney(budget.limit, budget.currency)}
                </Text>
              </View>
              <View style={styles.meter}>
                <View style={[styles.meterFill, { width: `${pct}%` }]} />
              </View>
            </View>
          );
        })}
      </View>
    ),
  });

  useFrontendTool({
    name: "summarize_mobile_spending",
    description:
      "Summarize local spending by category from the React Native app transaction list.",
    parameters: z.object({}),
    handler: async () => ({ categories: summarizeSpending(finance) }),
    render: () => (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Spending by Category</Text>
        {summarizeSpending(finance).map((category) => (
          <View key={`${category.category}:${category.currency}`} style={styles.row}>
            <Text style={styles.rowLabel}>{category.category}</Text>
            <Text style={styles.rowValue}>
              {formatMoney(category.spent, category.currency)}
            </Text>
          </View>
        ))}
      </View>
    ),
  });

  useFrontendTool({
    name: "list_mobile_activity",
    description: "Read the most recent local transactions in the React Native app.",
    parameters: z.object({}),
    handler: async () => ({ transactions: finance.transactions.slice(0, 8) }),
    render: () => (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Activity</Text>
        {finance.transactions.slice(0, 5).map((transaction) => (
          <View key={transaction.id} style={styles.row}>
            <View style={styles.rowStack}>
              <Text style={styles.rowLabel}>{transaction.merchant}</Text>
              <Text style={styles.rowMeta}>
                {transaction.category} · {transaction.date}
              </Text>
            </View>
            <Text style={styles.rowValue}>
              {formatMoney(transaction.amount, transaction.currency)}
            </Text>
          </View>
        ))}
      </View>
    ),
  });

  return null;
}
