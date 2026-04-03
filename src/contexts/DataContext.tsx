import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { getOccurrenceAmount } from '../calculations';
import type { Category, Expense, Income, Budget, UserData, BankAccount, PatrimoineAsset } from '../types';
import { getUserData, saveUserData } from '../storage';
import { useAuth } from './AuthContext';

interface DataContextValue {
  categories: Category[];
  expenses: Expense[];
  incomes: Income[];
  budgets: Budget[];
  bankAccounts: BankAccount[];
  patrimoineAssets: PatrimoineAsset[];
  // Categories
  addCategory: (cat: Omit<Category, 'id' | 'userId'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  // Expenses
  addExpense: (exp: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  togglePaid: (id: string, occurrenceMonth?: string) => void;
  // Incomes
  addIncome: (inc: Omit<Income, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  updateIncome: (id: string, updates: Partial<Income>) => void;
  deleteIncome: (id: string) => void;
  toggleReceived: (id: string, occurrenceMonth?: string) => void;
  // Budgets
  addBudget: (bud: Omit<Budget, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  updateBudget: (id: string, updates: Partial<Budget>) => void;
  deleteBudget: (id: string) => void;
  // Bank Accounts
  addBankAccount: (acc: Omit<BankAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  updateBankAccount: (id: string, updates: Partial<BankAccount>) => void;
  deleteBankAccount: (id: string) => void;
  // Patrimoine
  addPatrimoineAsset: (asset: Omit<PatrimoineAsset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  updatePatrimoineAsset: (id: string, updates: Partial<PatrimoineAsset>) => void;
  deletePatrimoineAsset: (id: string) => void;
  // Import/Reset
  importData: (data: UserData) => void;
  resetData: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const emptyData: UserData = {
  categories: [],
  expenses: [],
  incomes: [],
  budgets: [],
  bankAccounts: [],
  patrimoineAssets: [],
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [data, setData] = useState<UserData>(emptyData);

  useEffect(() => {
    if (currentUser) {
      const stored = getUserData(currentUser.id);
      if (stored) {
        // Migrate old data that may lack new fields
        setData({
          ...emptyData,
          ...stored,
          incomes: (stored.incomes ?? []).map((i: any) => ({
            status: 'expected',
            receivedOccurrences: [],
            ...i,
          })),
          bankAccounts: (stored.bankAccounts ?? []).map((a: any) => ({
            type: 'checking',
            showOnDashboard: true,
            includeInPatrimoine: false,
            ...a,
          })),
          patrimoineAssets: (stored.patrimoineAssets ?? []).map((a: any) => ({
            applyTax: a.applyTax ?? (a.type === 'CTO' || a.type === 'crypto'),
            taxRate: a.taxRate ?? 0.314,
            ...a,
            holdings: (a.holdings ?? []).map((h: any) => ({
              dividend: h.dividendYield ? {
                mode: 'manual',
                yieldPct: h.dividendYield,
              } : undefined,
              ...h,
            })),
          })),
        });
      } else {
        setData(emptyData);
      }
    } else {
      setData(emptyData);
    }
  }, [currentUser]);

  const persist = useCallback(
    (newData: UserData) => {
      if (!currentUser) return;
      setData(newData);
      saveUserData(currentUser.id, newData);
    },
    [currentUser]
  );

  const ts = () => new Date().toISOString();

  // --- Categories ---
  const addCategory = useCallback(
    (cat: Omit<Category, 'id' | 'userId'>) => {
      if (!currentUser) return;
      const newCat: Category = { ...cat, id: uuidv4(), userId: currentUser.id };
      persist({ ...data, categories: [...data.categories, newCat] });
    },
    [data, persist, currentUser]
  );

  const updateCategory = useCallback(
    (id: string, updates: Partial<Category>) => {
      persist({
        ...data,
        categories: data.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      });
    },
    [data, persist]
  );

  const deleteCategory = useCallback(
    (id: string) => {
      persist({ ...data, categories: data.categories.filter((c) => c.id !== id) });
    },
    [data, persist]
  );

  // --- Expenses ---
  const addExpense = useCallback(
    (exp: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      if (!currentUser) return;
      const currentMonth = format(new Date(), 'yyyy-MM');
      const newExp: Expense = {
        ...exp,
        paidOccurrences: exp.isRecurring && exp.status === 'paid' ? [currentMonth] : (exp.paidOccurrences ?? []),
        id: uuidv4(),
        userId: currentUser.id,
        createdAt: ts(),
        updatedAt: ts(),
      };

      // Débit immédiat si créée directement avec statut "payé"
      let updatedBankAccounts = data.bankAccounts ?? [];
      const isPaid = newExp.isRecurring
        ? (newExp.paidOccurrences ?? []).includes(currentMonth)
        : newExp.status === 'paid';
      if (isPaid && newExp.bankAccountId) {
        updatedBankAccounts = updatedBankAccounts.map((a) =>
          a.id === newExp.bankAccountId
            ? { ...a, balance: a.balance - newExp.amount, updatedAt: ts() }
            : a
        );
      }

      persist({ ...data, expenses: [...data.expenses, newExp], bankAccounts: updatedBankAccounts });
    },
    [data, persist, currentUser]
  );

  const updateExpense = useCallback(
    (id: string, updates: Partial<Expense>) => {
      const existing = data.expenses.find((e) => e.id === id);
      if (!existing) return;

      const updatedExpenses = data.expenses.map((e) =>
        e.id === id ? { ...e, ...updates, updatedAt: ts() } : e
      );

      // Ajuster le solde si le statut ou le compte a changé
      let updatedBankAccounts = data.bankAccounts ?? [];
      const oldPaid = existing.status === 'paid';
      const newPaid = (updates.status ?? existing.status) === 'paid';
      const oldAccountId = existing.bankAccountId;
      const newAccountId = updates.bankAccountId !== undefined ? updates.bankAccountId : existing.bankAccountId;
      const newAmount = updates.amount ?? existing.amount;

      if (oldPaid && oldAccountId) {
        // Rembourser l'ancien compte (annuler l'ancien débit)
        updatedBankAccounts = updatedBankAccounts.map((a) =>
          a.id === oldAccountId ? { ...a, balance: a.balance + existing.amount, updatedAt: ts() } : a
        );
      }
      if (newPaid && newAccountId) {
        // Débiter le nouveau compte
        updatedBankAccounts = updatedBankAccounts.map((a) =>
          a.id === newAccountId ? { ...a, balance: a.balance - newAmount, updatedAt: ts() } : a
        );
      }

      persist({ ...data, expenses: updatedExpenses, bankAccounts: updatedBankAccounts });
    },
    [data, persist]
  );

  const deleteExpense = useCallback(
    (id: string) => {
      persist({ ...data, expenses: data.expenses.filter((e) => e.id !== id) });
    },
    [data, persist]
  );

  const togglePaid = useCallback(
    (id: string, occurrenceMonth?: string) => {
      const expense = data.expenses.find((e) => e.id === id);
      if (!expense) return;

      const month = occurrenceMonth ?? format(new Date(), 'yyyy-MM');
      let nowPaid: boolean;
      let updatedExpense: Expense;

      if (expense.isRecurring && expense.frequency !== 'once') {
        // Mode récurrent : toggle uniquement le mois ciblé
        const paid = expense.paidOccurrences ?? [];
        const wasPaid = paid.includes(month);
        nowPaid = !wasPaid;
        updatedExpense = {
          ...expense,
          paidOccurrences: wasPaid ? paid.filter((m) => m !== month) : [...paid, month],
          updatedAt: ts(),
        };
      } else {
        // Mode ponctuel : toggle le status global
        const newStatus: import('../types').TransactionStatus =
          expense.status === 'paid' ? 'unpaid' : 'paid';
        nowPaid = newStatus === 'paid';
        updatedExpense = { ...expense, status: newStatus, updatedAt: ts() };
      }

      const updatedExpenses = data.expenses.map((e) => (e.id === id ? updatedExpense : e));

      // Débit/crédit immédiat sur le compte bancaire lié
      let updatedBankAccounts = data.bankAccounts ?? [];
      if (expense.bankAccountId) {
        const [oy, om] = month.split('-').map(Number);
        const occDateForAmount = new Date(oy, om - 1, 1);
        const occAmount = getOccurrenceAmount(expense, occDateForAmount);
        const delta = nowPaid ? -occAmount : occAmount;
        updatedBankAccounts = updatedBankAccounts.map((a) =>
          a.id === expense.bankAccountId
            ? { ...a, balance: a.balance + delta, updatedAt: ts() }
            : a
        );
      }

      persist({ ...data, expenses: updatedExpenses, bankAccounts: updatedBankAccounts });
    },
    [data, persist]
  );

  // --- Incomes ---
  const addIncome = useCallback(
    (inc: Omit<Income, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      if (!currentUser) return;
      const currentMonth = format(new Date(), 'yyyy-MM');
      const receivedOccs = inc.isRecurring && inc.status === 'received'
        ? [currentMonth]
        : (inc.receivedOccurrences ?? []);
      const newInc: Income = {
        ...inc,
        receivedOccurrences: receivedOccs,
        id: uuidv4(),
        userId: currentUser.id,
        createdAt: ts(),
        updatedAt: ts(),
      };

      // Crédit immédiat si revenu ponctuel déjà reçu
      let updatedBankAccounts = data.bankAccounts ?? [];
      const isReceived = newInc.isRecurring
        ? (newInc.receivedOccurrences ?? []).includes(currentMonth)
        : newInc.status === 'received';
      if (isReceived && newInc.bankAccountId) {
        updatedBankAccounts = updatedBankAccounts.map((a) =>
          a.id === newInc.bankAccountId
            ? { ...a, balance: a.balance + newInc.amount, updatedAt: ts() }
            : a
        );
      }

      persist({ ...data, incomes: [...data.incomes, newInc], bankAccounts: updatedBankAccounts });
    },
    [data, persist, currentUser]
  );

  const updateIncome = useCallback(
    (id: string, updates: Partial<Income>) => {
      const existing = data.incomes.find((i) => i.id === id);
      if (!existing) return;

      const updatedIncomes = data.incomes.map((i) =>
        i.id === id ? { ...i, ...updates, updatedAt: ts() } : i
      );

      // Ajuster le solde si le compte ou statut a changé
      let updatedBankAccounts = data.bankAccounts ?? [];
      const oldReceived = existing.status === 'received';
      const newReceived = (updates.status ?? existing.status) === 'received';
      const oldAccountId = existing.bankAccountId;
      const newAccountId = updates.bankAccountId !== undefined ? updates.bankAccountId : existing.bankAccountId;
      const newAmount = updates.amount ?? existing.amount;

      if (oldReceived && oldAccountId) {
        updatedBankAccounts = updatedBankAccounts.map((a) =>
          a.id === oldAccountId ? { ...a, balance: a.balance - existing.amount, updatedAt: ts() } : a
        );
      }
      if (newReceived && newAccountId) {
        updatedBankAccounts = updatedBankAccounts.map((a) =>
          a.id === newAccountId ? { ...a, balance: a.balance + newAmount, updatedAt: ts() } : a
        );
      }

      persist({ ...data, incomes: updatedIncomes, bankAccounts: updatedBankAccounts });
    },
    [data, persist]
  );

  const deleteIncome = useCallback(
    (id: string) => {
      persist({ ...data, incomes: data.incomes.filter((i) => i.id !== id) });
    },
    [data, persist]
  );

  const toggleReceived = useCallback(
    (id: string, occurrenceMonth?: string) => {
      const income = data.incomes.find((i) => i.id === id);
      if (!income) return;

      const month = occurrenceMonth ?? format(new Date(), 'yyyy-MM');
      let nowReceived: boolean;
      let updatedIncome: Income;

      if (income.isRecurring && income.frequency !== 'once') {
        const received = income.receivedOccurrences ?? [];
        const wasReceived = received.includes(month);
        nowReceived = !wasReceived;
        updatedIncome = {
          ...income,
          receivedOccurrences: wasReceived ? received.filter((m) => m !== month) : [...received, month],
          updatedAt: ts(),
        };
      } else {
        const newStatus: Income['status'] = income.status === 'received' ? 'expected' : 'received';
        nowReceived = newStatus === 'received';
        updatedIncome = { ...income, status: newStatus, updatedAt: ts() };
      }

      const updatedIncomes = data.incomes.map((i) => (i.id === id ? updatedIncome : i));

      // Crédit/débit du compte bancaire lié
      let updatedBankAccounts = data.bankAccounts ?? [];
      if (income.bankAccountId) {
        const [oy, om] = month.split('-').map(Number);
        const occDateForAmount = new Date(oy, om - 1, 1);
        const occAmount = getOccurrenceAmount(income, occDateForAmount);
        const delta = nowReceived ? occAmount : -occAmount;
        updatedBankAccounts = updatedBankAccounts.map((a) =>
          a.id === income.bankAccountId
            ? { ...a, balance: a.balance + delta, updatedAt: ts() }
            : a
        );
      }

      persist({ ...data, incomes: updatedIncomes, bankAccounts: updatedBankAccounts });
    },
    [data, persist]
  );

  // --- Budgets ---
  const addBudget = useCallback(
    (bud: Omit<Budget, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      if (!currentUser) return;
      const newBud: Budget = {
        ...bud,
        id: uuidv4(),
        userId: currentUser.id,
        createdAt: ts(),
        updatedAt: ts(),
      };
      persist({ ...data, budgets: [...data.budgets, newBud] });
    },
    [data, persist, currentUser]
  );

  const updateBudget = useCallback(
    (id: string, updates: Partial<Budget>) => {
      persist({
        ...data,
        budgets: data.budgets.map((b) =>
          b.id === id ? { ...b, ...updates, updatedAt: ts() } : b
        ),
      });
    },
    [data, persist]
  );

  const deleteBudget = useCallback(
    (id: string) => {
      persist({ ...data, budgets: data.budgets.filter((b) => b.id !== id) });
    },
    [data, persist]
  );

  // --- Bank Accounts ---
  const addBankAccount = useCallback(
    (acc: Omit<BankAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      if (!currentUser) return;
      const newAcc: BankAccount = {
        ...acc,
        id: uuidv4(),
        userId: currentUser.id,
        createdAt: ts(),
        updatedAt: ts(),
      };
      persist({ ...data, bankAccounts: [...(data.bankAccounts ?? []), newAcc] });
    },
    [data, persist, currentUser]
  );

  const updateBankAccount = useCallback(
    (id: string, updates: Partial<BankAccount>) => {
      persist({
        ...data,
        bankAccounts: (data.bankAccounts ?? []).map((a) =>
          a.id === id ? { ...a, ...updates, updatedAt: ts() } : a
        ),
      });
    },
    [data, persist]
  );

  const deleteBankAccount = useCallback(
    (id: string) => {
      persist({ ...data, bankAccounts: (data.bankAccounts ?? []).filter((a) => a.id !== id) });
    },
    [data, persist]
  );

  // --- Patrimoine ---
  const addPatrimoineAsset = useCallback(
    (asset: Omit<PatrimoineAsset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
      if (!currentUser) return;
      const newAsset: PatrimoineAsset = {
        ...asset,
        id: uuidv4(),
        userId: currentUser.id,
        createdAt: ts(),
        updatedAt: ts(),
      };
      persist({ ...data, patrimoineAssets: [...(data.patrimoineAssets ?? []), newAsset] });
    },
    [data, persist, currentUser]
  );

  const updatePatrimoineAsset = useCallback(
    (id: string, updates: Partial<PatrimoineAsset>) => {
      persist({
        ...data,
        patrimoineAssets: (data.patrimoineAssets ?? []).map((a) =>
          a.id === id ? { ...a, ...updates, updatedAt: ts() } : a
        ),
      });
    },
    [data, persist]
  );

  const deletePatrimoineAsset = useCallback(
    (id: string) => {
      persist({ ...data, patrimoineAssets: (data.patrimoineAssets ?? []).filter((a) => a.id !== id) });
    },
    [data, persist]
  );

  const importData = useCallback(
    (newData: UserData) => {
      persist({ ...emptyData, ...newData });
    },
    [persist]
  );

  const resetData = useCallback(() => {
    persist(emptyData);
  }, [persist]);

  return (
    <DataContext.Provider
      value={{
        ...data,
        bankAccounts: data.bankAccounts ?? [],
        patrimoineAssets: data.patrimoineAssets ?? [],
        addCategory,
        updateCategory,
        deleteCategory,
        addExpense,
        updateExpense,
        deleteExpense,
        togglePaid,
        addIncome,
        updateIncome,
        deleteIncome,
        toggleReceived,
        addBudget,
        updateBudget,
        deleteBudget,
        addBankAccount,
        updateBankAccount,
        deleteBankAccount,
        addPatrimoineAsset,
        updatePatrimoineAsset,
        deletePatrimoineAsset,
        importData,
        resetData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
