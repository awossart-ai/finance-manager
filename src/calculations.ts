import {
  addDays,
  addWeeks,
  addMonths,
  addQuarters,
  addYears,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
  isBefore,
  isAfter,
  startOfYear,
  endOfYear,
} from 'date-fns';
import type {
  Expense,
  Income,
  Category,
  Budget,
  BankAccount,
  MonthlyTotal,
  CategoryTotal,
  BudgetProgress,
  CashOccurrence,
} from './types';

/**
 * Parse an ISO date string (YYYY-MM-DD) as LOCAL midnight to avoid UTC timezone issues.
 * parseISO('2026-04-01') returns midnight UTC which in UTC+2 = March 31 22:00 local.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get the effective amount for an occurrence, respecting per-month overrides.
 */
export function getOccurrenceAmount(
  item: { amount: number; amountOverrides?: Record<string, number> },
  date: Date
): number {
  const month = format(date, 'yyyy-MM');
  return item.amountOverrides?.[month] ?? item.amount;
}

/**
 * Generate all occurrences of an expense/income within a date range
 */
export function getOccurrences(
  item: { dueDate?: string; date?: string; frequency: string; endDate?: string; isRecurring: boolean },
  startDate: Date,
  endDate: Date
): Date[] {
  const dateStr = item.dueDate || item.date || '';
  if (!dateStr) return [];

  const itemDate = parseLocalDate(dateStr);
  const occurrences: Date[] = [];

  if (!item.isRecurring || item.frequency === 'once') {
    if (isWithinInterval(itemDate, { start: startDate, end: endDate })) {
      occurrences.push(itemDate);
    }
    return occurrences;
  }

  const effectiveEnd = item.endDate
    ? new Date(Math.min(parseLocalDate(item.endDate).getTime(), endDate.getTime()))
    : endDate;

  let current = itemDate;

  // Advance to start of range if item date is before range
  while (isBefore(current, startDate)) {
    current = advanceByFrequency(current, item.frequency);
  }

  while (!isAfter(current, effectiveEnd) && !isAfter(current, endDate)) {
    if (!isBefore(current, startDate)) {
      occurrences.push(new Date(current));
    }
    current = advanceByFrequency(current, item.frequency);
  }

  return occurrences;
}

function advanceByFrequency(date: Date, frequency: string): Date {
  switch (frequency) {
    case 'daily':
      return addDays(date, 1);
    case 'weekly':
      return addWeeks(date, 1);
    case 'biweekly':
      return addWeeks(date, 2);
    case 'monthly':
      return addMonths(date, 1);
    case 'quarterly':
      return addQuarters(date, 1);
    case 'annual':
      return addYears(date, 1);
    default:
      return addYears(date, 100); // effectively stop
  }
}

/**
 * Retourne la prochaine occurrence impayée d'une dépense récurrente à partir de fromDate.
 * Pour les dépenses ponctuelles, retourne la date d'échéance si non payée.
 */
export function getNextUnpaidOccurrence(expense: Expense, fromDate: Date): Date | null {
  if (!expense.isRecurring || expense.frequency === 'once') {
    return expense.status !== 'paid' ? parseLocalDate(expense.dueDate) : null;
  }
  const searchEnd = addYears(fromDate, 2);
  const occs = getOccurrences(expense, fromDate, searchEnd);
  for (const d of occs) {
    if (!(expense.paidOccurrences ?? []).includes(format(d, 'yyyy-MM'))) return d;
  }
  return null;
}

/**
 * Retourne si une occurrence spécifique d'un revenu est reçue.
 */
export function isIncomeOccurrenceReceived(income: Income, date: Date): boolean {
  if (!income.isRecurring || income.frequency === 'once') {
    return income.status === 'received';
  }
  return (income.receivedOccurrences ?? []).includes(format(date, 'yyyy-MM'));
}

/**
 * Retourne la prochaine occurrence non reçue d'un revenu récurrent.
 */
export function getNextUnreceivedOccurrence(income: Income, fromDate: Date): Date | null {
  if (!income.isRecurring || income.frequency === 'once') {
    return income.status !== 'received' ? parseLocalDate(income.date) : null;
  }
  const searchEnd = addYears(fromDate, 2);
  const occs = getOccurrences(income, fromDate, searchEnd);
  for (const d of occs) {
    if (!(income.receivedOccurrences ?? []).includes(format(d, 'yyyy-MM'))) return d;
  }
  return null;
}

/**
 * Retourne si une occurrence spécifique d'une dépense est payée.
 * - Non-récurrente : utilise le champ status
 * - Récurrente : vérifie si le mois de l'occurrence est dans paidOccurrences
 */
export function isOccurrencePaid(expense: Expense, date: Date): boolean {
  if (!expense.isRecurring || expense.frequency === 'once') {
    return expense.status === 'paid';
  }
  const month = format(date, 'yyyy-MM');
  return (expense.paidOccurrences ?? []).includes(month);
}

/**
 * Calculate cash needed in a date range
 */
export interface CashBreakdown {
  total: number;
  byMonth: { month: string; label: string; items: CashOccurrence[]; subtotal: number }[];
  occurrences: CashOccurrence[];
}

export function calculateCashNeeded(
  expenses: Expense[],
  startDate: Date,
  endDate: Date,
  onlyUnpaid = false
): CashBreakdown {
  const cashExpenses = expenses.filter((e) => e.isCash);

  const occurrences: CashOccurrence[] = [];

  for (const expense of cashExpenses) {
    const dates = getOccurrences(expense, startDate, endDate);
    for (const d of dates) {
      if (onlyUnpaid && isOccurrencePaid(expense, d)) continue;
      occurrences.push({
        expense,
        date: d,
        month: format(d, 'yyyy-MM'),
      });
    }
  }

  // Sort by date
  occurrences.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group by month
  const monthMap = new Map<string, CashOccurrence[]>();
  for (const occ of occurrences) {
    const key = occ.month;
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(occ);
  }

  const byMonth = Array.from(monthMap.entries()).map(([month, items]) => {
    const [year, m] = month.split('-').map(Number);
    const label = format(new Date(year, m - 1, 1), 'MMMM yyyy', { locale: undefined });
    const subtotal = items.reduce((s, i) => s + getOccurrenceAmount(i.expense, i.date), 0);
    return { month, label, items, subtotal };
  });

  const total = occurrences.reduce((s, o) => s + getOccurrenceAmount(o.expense, o.date), 0);

  return { total, byMonth, occurrences };
}

/**
 * Get monthly totals for last N months (for area chart)
 */
export function getMonthlyTotals(
  expenses: Expense[],
  incomes: Income[],
  year: number,
  months = 12
): MonthlyTotal[] {
  const result: MonthlyTotal[] = [];

  for (let m = 0; m < months; m++) {
    const date = new Date(year, m, 1);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    let incomeTotal = 0;
    let expenseTotal = 0;

    for (const income of incomes) {
      const occs = getOccurrences(income, start, end);
      for (const occ of occs) incomeTotal += getOccurrenceAmount(income, occ);
    }

    for (const expense of expenses) {
      const occs = getOccurrences(expense, start, end);
      for (const occ of occs) expenseTotal += getOccurrenceAmount(expense, occ);
    }

    result.push({
      month: format(date, 'MMM'),
      income: incomeTotal,
      expenses: expenseTotal,
      balance: incomeTotal - expenseTotal,
    });
  }

  return result;
}

/**
 * Get category totals for a specific month/year (for pie chart)
 */
export function getCategoryTotals(
  expenses: Expense[],
  categories: Category[],
  month: number,
  year: number
): CategoryTotal[] {
  const date = new Date(year, month - 1, 1);
  const start = startOfMonth(date);
  const end = endOfMonth(date);

  const totals = new Map<string, number>();

  for (const expense of expenses) {
    const occs = getOccurrences(expense, start, end);
    if (occs.length > 0) {
      let occTotal = 0;
      for (const occ of occs) occTotal += getOccurrenceAmount(expense, occ);
      const current = totals.get(expense.categoryId) || 0;
      totals.set(expense.categoryId, current + occTotal);
    }
  }

  const result: CategoryTotal[] = [];
  for (const [categoryId, amount] of totals.entries()) {
    const cat = categories.find((c) => c.id === categoryId);
    if (cat && amount > 0) {
      result.push({
        categoryId,
        name: cat.name,
        color: cat.color,
        amount,
      });
    }
  }

  return result.sort((a, b) => b.amount - a.amount);
}

/**
 * Get budget progress for a month/year (supports recurring budgets)
 */
export function getBudgetProgress(
  expenses: Expense[],
  budgets: Budget[],
  categories: Category[],
  month: number,
  year: number
): BudgetProgress[] {
  const date = new Date(year, month - 1, 1);
  const start = startOfMonth(date);
  const end = endOfMonth(date);

  // Exact match for this month/year
  const exactBudgets = budgets.filter(
    (b) => b.periodType === 'monthly' && b.month === month && b.year === year
  );
  const exactCategoryIds = new Set(exactBudgets.map((b) => b.categoryId));

  // Recurring budgets that cover this period (when no exact match exists)
  const recurringByCategory = new Map<string, Budget>();
  for (const b of budgets) {
    if (!b.isRecurring || b.periodType !== 'monthly') continue;
    if (exactCategoryIds.has(b.categoryId)) continue;
    const budgetStart = new Date(b.year, (b.month ?? 1) - 1, 1);
    if (isAfter(budgetStart, date)) continue; // budget starts in the future
    if (b.repeatUntil && isAfter(startOfMonth(date), startOfMonth(parseISO(b.repeatUntil)))) continue;
    // Keep most recent recurring budget for each category
    const existing = recurringByCategory.get(b.categoryId);
    if (!existing || new Date(b.createdAt) > new Date(existing.createdAt)) {
      recurringByCategory.set(b.categoryId, b);
    }
  }

  const relevantBudgets = [...exactBudgets, ...Array.from(recurringByCategory.values())];

  return relevantBudgets.map((budget) => {
    const category = categories.find((c) => c.id === budget.categoryId)!;
    let actual = 0;

    for (const expense of expenses) {
      if (expense.categoryId === budget.categoryId) {
        const occs = getOccurrences(expense, start, end);
        for (const occ of occs) {
          if (isOccurrencePaid(expense, occ)) actual += getOccurrenceAmount(expense, occ);
        }
      }
    }

    const percentage = budget.amount > 0 ? (actual / budget.amount) * 100 : 0;

    return {
      budget,
      category,
      actual,
      percentage,
      remaining: budget.amount - actual,
    };
  }).filter((bp) => bp.category);
}

/**
 * Get annual budget progress
 */
export function getAnnualBudgetProgress(
  expenses: Expense[],
  budgets: Budget[],
  categories: Category[],
  year: number
): BudgetProgress[] {
  const start = startOfYear(new Date(year, 0, 1));
  const end = endOfYear(new Date(year, 0, 1));

  const relevantBudgets = budgets.filter(
    (b) => b.periodType === 'annual' && b.year === year
  );

  return relevantBudgets.map((budget) => {
    const category = categories.find((c) => c.id === budget.categoryId)!;
    let actual = 0;

    for (const expense of expenses) {
      if (expense.categoryId === budget.categoryId) {
        const occs = getOccurrences(expense, start, end);
        for (const occ of occs) {
          if (isOccurrencePaid(expense, occ)) actual += getOccurrenceAmount(expense, occ);
        }
      }
    }

    const percentage = budget.amount > 0 ? (actual / budget.amount) * 100 : 0;

    return {
      budget,
      category,
      actual,
      percentage,
      remaining: budget.amount - actual,
    };
  }).filter((bp) => bp.category);
}

/**
 * Get month total for expenses and incomes
 */
export function getMonthTotal(
  items: Expense[] | Income[],
  month: number,
  year: number
): number {
  const date = new Date(year, month - 1, 1);
  const start = startOfMonth(date);
  const end = endOfMonth(date);

  let total = 0;
  for (const item of items) {
    const occs = getOccurrences(item as Expense, start, end);
    for (const occ of occs) total += getOccurrenceAmount(item as Expense, occ);
  }
  return total;
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Projected balance per account and globally until a given date
 */
export interface ProjectedAccountBalance {
  accountId: string;
  accountName: string;
  accountColor: string;
  currentBalance: number;
  pendingExpenses: number;
  projectedBalance: number;
}

export interface GlobalProjection {
  currentTotal: number;
  expectedIncomes: number;
  pendingExpenses: number;
  projectedTotal: number;
}

export function getProjectedBalance(
  accounts: BankAccount[],
  expenses: Expense[],
  incomes: Income[],
  fromDate: Date,
  toDate: Date
): { perAccount: ProjectedAccountBalance[]; global: GlobalProjection } {
  const perAccount: ProjectedAccountBalance[] = accounts.map((account) => {
    let pendingExpenses = 0;
    for (const expense of expenses) {
      if (expense.bankAccountId !== account.id) continue;
      const occs = getOccurrences(expense, fromDate, toDate);
      for (const d of occs) {
        if (!isOccurrencePaid(expense, d)) pendingExpenses += getOccurrenceAmount(expense, d);
      }
    }
    return {
      accountId: account.id,
      accountName: account.name,
      accountColor: account.color,
      currentBalance: account.balance,
      pendingExpenses,
      projectedBalance: account.balance - pendingExpenses,
    };
  });

  const currentTotal = accounts.reduce((s, a) => s + a.balance, 0);

  let totalPendingExpenses = 0;
  for (const expense of expenses) {
    const occs = getOccurrences(expense, fromDate, toDate);
    for (const d of occs) {
      if (!isOccurrencePaid(expense, d)) totalPendingExpenses += getOccurrenceAmount(expense, d);
    }
  }

  let expectedIncomes = 0;
  for (const income of incomes) {
    const occs = getOccurrences(income, fromDate, toDate);
    for (const occ of occs) expectedIncomes += getOccurrenceAmount(income, occ);
  }

  return {
    perAccount,
    global: {
      currentTotal,
      expectedIncomes,
      pendingExpenses: totalPendingExpenses,
      projectedTotal: currentTotal + expectedIncomes - totalPendingExpenses,
    },
  };
}

export function formatFrequency(freq: string): string {
  const map: Record<string, string> = {
    once: 'Une fois',
    daily: 'Quotidien',
    weekly: 'Hebdomadaire',
    biweekly: 'Bimensuel',
    monthly: 'Mensuel',
    quarterly: 'Trimestriel',
    annual: 'Annuel',
  };
  return map[freq] || freq;
}
