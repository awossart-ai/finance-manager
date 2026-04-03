import React, { useState, useMemo, useCallback } from 'react';
import {
  Calculator,
  Calendar,
  Printer,
  Banknote,
  CreditCard,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  Building2,
  X,
  Check,
  Wallet,
  TrendingUp,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  addMonths,
  isAfter,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { calculateCashNeeded, getOccurrences, formatCurrency, formatFrequency, getProjectedBalance, isOccurrencePaid, getBudgetProgress } from '../calculations';
import type { BankAccount } from '../types';
import { v4 as uuidv4 } from 'uuid';

type PeriodPreset = 'this-month' | 'next-month' | 'this-quarter' | 'this-year' | 'custom';
type CalcMode = 'cash' | 'unpaid' | 'accounts' | 'forecast';

function getPeriodDates(preset: PeriodPreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case 'this-month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'next-month': {
      const next = addMonths(now, 1);
      return { start: startOfMonth(next), end: endOfMonth(next) };
    }
    case 'this-quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'this-year':
      return { start: startOfYear(now), end: endOfYear(now) };
    case 'custom':
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

const PRESET_LABELS: Record<PeriodPreset, string> = {
  'this-month': 'Ce mois',
  'next-month': 'Mois prochain',
  'this-quarter': 'Ce trimestre',
  'this-year': 'Cette année',
  custom: 'Personnalisé',
};

const ACCOUNT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f59e0b', '#10b981', '#3b82f6', '#ef4444',
];

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Compte courant',
  savings: 'Compte épargne',
  livret: 'Livret réglementé (Livret A, LDDS…)',
  cash: 'Espèces',
  other: 'Autre',
};

const emptyAccountForm = () => ({
  name: '',
  balance: 0,
  color: '#6366f1',
  type: 'checking' as import('../types').BankAccountType,
  isDefault: false,
  showOnDashboard: true,
  includeInPatrimoine: false,
  interestRate: 0,
});

export default function CashCalculator() {
  const { expenses, incomes, categories, budgets, bankAccounts, addBankAccount, updateBankAccount, deleteBankAccount } = useData();
  const { currentUser } = useAuth();
  const currency = currentUser?.settings?.currency ?? 'EUR';
  const fmt = (n: number) => formatCurrency(n, currency);

  const [mode, setMode] = useState<CalcMode>('unpaid');
  const [preset, setPreset] = useState<PeriodPreset>('this-month');
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const [forecastIncludeIncome, setForecastIncludeIncome] = useState(true);
  const [forecastIncludeBudget, setForecastIncludeBudget] = useState(true);
  const [unpaidIncludeBudget, setUnpaidIncludeBudget] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const initialDates = getPeriodDates('this-month');
  const [customStart, setCustomStart] = useState(format(initialDates.start, 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(initialDates.end, 'yyyy-MM-dd'));

  // Account management state
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [accountForm, setAccountForm] = useState(emptyAccountForm());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { start, end } = useMemo(() => {
    if (preset === 'custom') {
      return {
        start: customStart ? new Date(customStart) : getPeriodDates('this-month').start,
        end: customEnd ? new Date(customEnd) : getPeriodDates('this-month').end,
      };
    }
    return getPeriodDates(preset);
  }, [preset, customStart, customEnd]);

  // Cash calculator (espèces)
  const cashBreakdown = useMemo(
    () => calculateCashNeeded(expenses, start, end, onlyUnpaid),
    [expenses, start, end, onlyUnpaid]
  );

  // Types shared between unpaid and budget items
  type ExpItem = { kind: 'expense'; expense: (typeof expenses)[0]; date: Date; month: string };
  type BudItem = { kind: 'budget'; name: string; color: string; remaining: number; periodLabel: string; isRecurring: boolean; date: Date; month: string };
  type AnyItem = ExpItem | BudItem;

  // Pure expense unpaid items
  const unpaidExpenseItems = useMemo(() => {
    const items: ExpItem[] = [];
    for (const exp of expenses) {
      if (selectedAccountId !== 'all' && exp.bankAccountId !== selectedAccountId) continue;
      const dates = getOccurrences(exp, start, end);
      for (const d of dates) {
        if (isOccurrencePaid(exp, d)) continue;
        items.push({ kind: 'expense', expense: exp, date: d, month: format(d, 'yyyy-MM') });
      }
    }
    return items;
  }, [expenses, start, end, selectedAccountId]);

  // Budget virtual items (current and future months in the period)
  const unpaidBudgetItems = useMemo(() => {
    const items: BudItem[] = [];
    const today = startOfMonth(new Date());
    let budMonth = startOfMonth(isAfter(today, start) ? today : start);
    while (!isAfter(budMonth, end)) {
      const progress = getBudgetProgress(expenses, budgets, categories, budMonth.getMonth() + 1, budMonth.getFullYear());
      for (const bp of progress) {
        if (bp.budget.showAsExpense && bp.remaining > 0) {
          items.push({
            kind: 'budget',
            name: bp.category.name,
            color: bp.category.color,
            remaining: bp.remaining,
            periodLabel: bp.budget.periodType === 'annual' ? 'Annuel' : 'Mensuel',
            isRecurring: bp.budget.isRecurring ?? false,
            date: budMonth,
            month: format(budMonth, 'yyyy-MM'),
          });
        }
      }
      budMonth = addMonths(budMonth, 1);
    }
    return items;
  }, [expenses, budgets, categories, start, end]);

  // Merged breakdown (toggle-aware)
  const unpaidBreakdown = useMemo(() => {
    const items: AnyItem[] = [
      ...unpaidExpenseItems,
      ...(unpaidIncludeBudget ? unpaidBudgetItems : []),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    const monthMap = new Map<string, AnyItem[]>();
    for (const item of items) {
      if (!monthMap.has(item.month)) monthMap.set(item.month, []);
      monthMap.get(item.month)!.push(item);
    }

    const byMonth = Array.from(monthMap.entries()).map(([month, its]) => {
      const [year, m] = month.split('-').map(Number);
      const label = format(new Date(year, m - 1, 1), 'MMMM yyyy', { locale: fr });
      const subtotal = its.reduce((s, i) => s + (i.kind === 'expense' ? i.expense.amount : i.remaining), 0);
      return { month, label, items: its, subtotal };
    });

    const total = items.reduce((s, i) => s + (i.kind === 'expense' ? i.expense.amount : i.remaining), 0);
    return { total, byMonth, count: items.length };
  }, [unpaidExpenseItems, unpaidBudgetItems, unpaidIncludeBudget]);

  // Total liquidity across all accounts
  const totalLiquidity = useMemo(
    () => bankAccounts.reduce((s, a) => s + a.balance, 0),
    [bankAccounts]
  );

  // Projected balance: from today to period end
  const forecastProjection = useMemo(() => {
    const today = new Date();
    const fromDate = today > start ? today : start;
    return getProjectedBalance(bankAccounts, expenses, incomes, fromDate, end);
  }, [bankAccounts, expenses, incomes, start, end]);

  // Budget remaining for the current calendar month (only budgets with showAsExpense=true)
  const forecastBudgetRemaining = useMemo(() => {
    const now = new Date();
    // Only relevant if the selected period overlaps with the current month
    const curMonth = now.getMonth() + 1;
    const curYear = now.getFullYear();
    const progress = getBudgetProgress(expenses, budgets, categories, curMonth, curYear);
    return progress
      .filter((bp) => bp.budget.showAsExpense === true && bp.remaining > 0)
      .reduce((s, bp) => s + bp.remaining, 0);
  }, [expenses, budgets, categories]);

  const getCategoryById = (id: string) => categories.find((c) => c.id === id);

  const handlePrint = () => window.print();

  // All accounts including livrets (which are also patrimoine)
  const allDisplayAccounts = useMemo(() => bankAccounts, [bankAccounts]);

  const openAddAccount = () => {
    setEditingAccount(null);
    setAccountForm(emptyAccountForm());
    setShowAccountModal(true);
  };

  const openEditAccount = (acc: BankAccount) => {
    setEditingAccount(acc);
    setAccountForm({
      name: acc.name,
      balance: acc.balance,
      color: acc.color,
      type: acc.type ?? 'checking',
      isDefault: acc.isDefault,
      showOnDashboard: acc.showOnDashboard !== false,
      includeInPatrimoine: acc.includeInPatrimoine ?? false,
      interestRate: acc.interestRate ?? 0,
    });
    setShowAccountModal(true);
  };

  const handleSaveAccount = () => {
    if (!accountForm.name.trim()) return;
    const payload = {
      ...accountForm,
      includeInPatrimoine: accountForm.type === 'livret' ? true : accountForm.includeInPatrimoine,
    };
    if (editingAccount) {
      updateBankAccount(editingAccount.id, payload);
    } else {
      addBankAccount(payload);
    }
    setShowAccountModal(false);
  };

  const handleDeleteAccount = (id: string) => {
    deleteBankAccount(id);
    setDeleteConfirm(null);
    if (selectedAccountId === id) setSelectedAccountId('all');
  };

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {([
          { id: 'unpaid', label: 'Impayés à venir', icon: <AlertCircle className="w-4 h-4" /> },
          { id: 'cash', label: 'Espèces', icon: <Banknote className="w-4 h-4" /> },
          { id: 'accounts', label: 'Comptes', icon: <Building2 className="w-4 h-4" /> },
          { id: 'forecast', label: 'Solde prévisionnel', icon: <TrendingUp className="w-4 h-4" /> },
        ] as { id: CalcMode; label: string; icon: React.ReactNode }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === tab.id
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ACCOUNTS MODE                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {mode === 'accounts' && (
        <div className="space-y-4">
          {/* Total liquidity card */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm mb-1">Liquidités totales</p>
                <p className="text-4xl font-bold">{fmt(totalLiquidity)}</p>
                <p className="text-indigo-200 text-sm mt-1">{bankAccounts.length} compte{bankAccounts.length > 1 ? 's' : ''}</p>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <Wallet className="w-8 h-8" />
              </div>
            </div>
          </div>

          {/* Accounts list */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
              <h2 className="font-semibold text-gray-900 dark:text-white">Mes comptes</h2>
              <button
                onClick={openAddAccount}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm rounded-lg transition-all font-medium"
              >
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            </div>

            {bankAccounts.length === 0 ? (
              <div className="p-10 text-center">
                <Building2 className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Aucun compte bancaire. Ajoutez vos comptes pour suivre vos liquidités.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {bankAccounts.map((acc) => (
                  <div key={acc.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: acc.color }}
                      >
                        {acc.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{acc.name}</p>
                        <div className="flex items-center gap-2">
                          {acc.type && <span className="text-xs text-gray-400">{ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}</span>}
                          {acc.isDefault && <span className="text-xs text-indigo-500">Principal</span>}
                          {acc.includeInPatrimoine && <span className="text-xs text-teal-500">Patrimoine</span>}
                        </div>
                        {acc.interestRate ? <p className="text-xs text-emerald-500">{acc.interestRate}%/an</p> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${acc.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {fmt(acc.balance)}
                      </span>
                      <button onClick={() => openEditAccount(acc)} className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {deleteConfirm === acc.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDeleteAccount(acc.id)} className="p-1.5 text-red-500 hover:text-red-600">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(acc.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CASH & UNPAID MODES — period controls                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      {(mode === 'cash' || mode === 'unpaid' || mode === 'forecast') && (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-slate-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Période</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.keys(PRESET_LABELS) as PeriodPreset[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    preset === p
                      ? 'bg-indigo-500 text-white shadow-sm'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Début</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fin</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Filters */}
            {mode === 'forecast' && (
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setForecastIncludeIncome(!forecastIncludeIncome)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${forecastIncludeIncome ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${forecastIncludeIncome ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Inclure les revenus attendus</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setForecastIncludeBudget(!forecastIncludeBudget)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${forecastIncludeBudget ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${forecastIncludeBudget ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Inclure les budgets restants</span>
                </label>
              </div>
            )}
            {mode !== 'forecast' && (
              <div className="flex flex-wrap items-center gap-4">
                {mode === 'cash' && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setOnlyUnpaid(!onlyUnpaid)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${onlyUnpaid ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${onlyUnpaid ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Seulement les impayés</span>
                  </label>
                )}

                {mode === 'unpaid' && bankAccounts.length > 0 && (
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Compte :</span>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">Tous les comptes</option>
                      {bankAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>{acc.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {mode === 'unpaid' && unpaidBudgetItems.length > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setUnpaidIncludeBudget(!unpaidIncludeBudget)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${unpaidIncludeBudget ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${unpaidIncludeBudget ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Inclure les budgets restants</span>
                  </label>
                )}
              </div>
            )}
          </div>

          {/* ─── CASH MODE ─── */}
          {mode === 'cash' && (
            <>
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-indigo-100 text-sm mb-1">Total espèces nécessaires</p>
                    <p className="text-4xl font-bold">{fmt(cashBreakdown.total)}</p>
                    <p className="text-indigo-200 text-sm mt-2">
                      {format(start, 'd MMM yyyy', { locale: fr })} — {format(end, 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Banknote className="w-8 h-8" />
                  </div>
                </div>
              </div>

              {cashBreakdown.occurrences.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-gray-200 dark:border-slate-700">
                  <Calculator className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Aucune dépense en espèces pour cette période.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cashBreakdown.byMonth.map(({ month: monthKey, label, items, subtotal }) => (
                    <div key={monthKey} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          <span className="font-semibold text-gray-900 dark:text-white capitalize">{label}</span>
                        </div>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">{fmt(subtotal)}</span>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-slate-700">
                        {items.map((occ, idx) => {
                          const cat = getCategoryById(occ.expense.categoryId);
                          return (
                            <div key={`${occ.expense.id}-${idx}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat?.color ?? '#6366f1' }} />
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{occ.expense.name}</p>
                                  <div className="flex items-center gap-2 text-xs text-gray-400">
                                    {cat && <span>{cat.name}</span>}
                                    <span>·</span>
                                    <span>{format(occ.date, 'd MMM', { locale: fr })}</span>
                                    {occ.expense.frequency !== 'once' && (
                                      <><span>·</span><span className="capitalize">{formatFrequency(occ.expense.frequency)}</span></>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-gray-900 dark:text-white">{fmt(occ.expense.amount)}</span>
                                {occ.expense.status === 'paid' && <p className="text-xs text-emerald-500">Payé</p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <button onClick={handlePrint} className="no-print flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all">
                    <Printer className="w-4 h-4" /> Imprimer / Exporter
                  </button>
                </div>
              )}
            </>
          )}

          {/* ─── FORECAST MODE ─── */}
          {mode === 'forecast' && (
            <>
              {/* Global projection card */}
              {(() => {
                const budgetDeduction = forecastIncludeBudget ? unpaidBudgetItems.reduce((s, i) => s + i.remaining, 0) : 0;
                const adjustedTotal = forecastProjection.global.currentTotal
                  + (forecastIncludeIncome ? forecastProjection.global.expectedIncomes : 0)
                  - forecastProjection.global.pendingExpenses
                  - budgetDeduction;
                return (
                  <>
                    <div className={`rounded-xl p-6 text-white shadow-lg ${adjustedTotal >= 0 ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-red-500 to-orange-500'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/80 text-sm mb-1">Solde prévisionnel global</p>
                          <p className="text-4xl font-bold">{fmt(adjustedTotal)}</p>
                          <p className="text-white/70 text-sm mt-2">
                            au {format(end, 'd MMM yyyy', { locale: fr })}
                          </p>
                          {forecastIncludeBudget && budgetDeduction > 0 && (
                            <p className="text-white/60 text-xs italic mt-1">dont -{fmt(budgetDeduction)} de budgets restants</p>
                          )}
                        </div>
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                          <TrendingUp className="w-8 h-8" />
                        </div>
                      </div>
                    </div>

                    {/* Summary row — toujours 3 colonnes */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Solde actuel total</p>
                        <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{fmt(forecastProjection.global.currentTotal)}</p>
                      </div>
                      <div className={`rounded-xl p-4 border ${forecastIncludeIncome ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700' : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 opacity-50'}`}>
                        <div className="flex items-center gap-1 mb-1">
                          <ArrowUp className="w-3 h-3 text-emerald-500" />
                          <p className="text-xs text-gray-500 dark:text-gray-400">Revenus attendus</p>
                        </div>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">+{fmt(forecastProjection.global.expectedIncomes)}</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-1 mb-1">
                          <ArrowDown className="w-3 h-3 text-red-500" />
                          <p className="text-xs text-gray-500 dark:text-gray-400">Dépenses impayées</p>
                        </div>
                        <p className="text-xl font-bold text-red-500">
                          -{fmt(forecastProjection.global.pendingExpenses + (forecastIncludeBudget ? budgetDeduction : 0))}
                        </p>
                        {forecastIncludeBudget && budgetDeduction > 0 && (
                          <p className="text-xs text-indigo-400 italic mt-0.5">dont -{fmt(budgetDeduction)} de budgets</p>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Per-account projections */}
              {bankAccounts.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                    <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Projection par compte</h2>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {forecastProjection.perAccount.map((proj) => (
                      <div key={proj.accountId} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{ backgroundColor: proj.accountColor }}
                          >
                            {proj.accountName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{proj.accountName}</p>
                            {proj.pendingExpenses > 0 && (
                              <p className="text-xs text-red-400">-{fmt(proj.pendingExpenses)} impayés</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400 mb-0.5">Actuel: {fmt(proj.currentBalance)}</p>
                          <p className={`font-bold text-base ${proj.projectedBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                            {fmt(proj.projectedBalance)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bankAccounts.length === 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-gray-200 dark:border-slate-700">
                  <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Ajoutez des comptes bancaires pour voir la projection.</p>
                </div>
              )}

              {/* Budget items in forecast — grouped by month like unpaid list */}
              {forecastIncludeBudget && unpaidBudgetItems.length > 0 && (
                <div className="space-y-4">
                  {(() => {
                    const monthMap = new Map<string, BudItem[]>();
                    for (const item of unpaidBudgetItems) {
                      if (!monthMap.has(item.month)) monthMap.set(item.month, []);
                      monthMap.get(item.month)!.push(item);
                    }
                    return Array.from(monthMap.entries()).map(([monthKey, its]) => {
                      const [year, m] = monthKey.split('-').map(Number);
                      const label = format(new Date(year, m - 1, 1), 'MMMM yyyy', { locale: fr });
                      const subtotal = its.reduce((s, i) => s + i.remaining, 0);
                      return (
                        <div key={monthKey} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-indigo-200 dark:border-indigo-800 overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 bg-indigo-50/50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-indigo-500" />
                              <span className="font-semibold text-gray-900 dark:text-white capitalize">{label}</span>
                              <span className="text-xs text-indigo-400">budgets restants</span>
                            </div>
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">-{fmt(subtotal)}</span>
                          </div>
                          <div className="divide-y divide-gray-100 dark:divide-slate-700">
                            {its.map((item, idx) => (
                              <div key={`${item.name}-${idx}`} className="flex items-center justify-between px-4 py-3 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                  <div>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</p>
                                    <p className="text-xs text-gray-400">{item.periodLabel}{item.isRecurring ? ' ↻' : ''}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">Budget</span>
                                  <span className="font-semibold text-indigo-500">-{fmt(item.remaining)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </>
          )}

          {/* ─── UNPAID MODE ─── */}
          {mode === 'unpaid' && (
            <>
              <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-100 text-sm mb-1">Total impayés à venir</p>
                    <p className="text-4xl font-bold">{fmt(unpaidBreakdown.total)}</p>
                    <p className="text-red-100 text-sm mt-2">
                      {unpaidBreakdown.count} échéance{unpaidBreakdown.count > 1 ? 's' : ''} · {format(start, 'd MMM yyyy', { locale: fr })} — {format(end, 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                </div>
              </div>

              {/* Liquidity coverage */}
              {bankAccounts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Liquidités disponibles</p>
                    <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{fmt(totalLiquidity)}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Impayés à couvrir</p>
                    <p className="text-xl font-bold text-red-500">{fmt(unpaidBreakdown.total)}</p>
                    {unpaidIncludeBudget && unpaidBudgetItems.length > 0 && (
                      <p className="text-xs text-indigo-400 italic mt-0.5">dont {fmt(unpaidBudgetItems.reduce((s, i) => s + i.remaining, 0))} de budgets</p>
                    )}
                  </div>
                  <div className={`rounded-xl p-4 border ${totalLiquidity - unpaidBreakdown.total >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Solde après paiement</p>
                    <p className={`text-xl font-bold ${totalLiquidity - unpaidBreakdown.total >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {fmt(totalLiquidity - unpaidBreakdown.total)}
                    </p>
                  </div>
                </div>
              )}

              {unpaidBreakdown.byMonth.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-gray-200 dark:border-slate-700">
                  <Check className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <p className="text-gray-400">Aucun impayé pour cette période.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {unpaidBreakdown.byMonth.map(({ month: monthKey, label, items, subtotal }) => (
                    <div key={monthKey} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-red-50 dark:bg-red-900/10 border-b border-gray-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-red-500" />
                          <span className="font-semibold text-gray-900 dark:text-white capitalize">{label}</span>
                        </div>
                        <span className="font-semibold text-red-600 dark:text-red-400">{fmt(subtotal)}</span>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-slate-700">
                        {items.map((item, idx) => {
                          if (item.kind === 'budget') {
                            return (
                              <div key={`budget-${item.name}-${idx}`} className="flex items-center justify-between px-4 py-3 bg-indigo-50/40 dark:bg-indigo-900/10 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                  <div>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name} <span className="text-xs text-indigo-400">budget restant</span></p>
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                      <span>{item.periodLabel}{item.isRecurring ? ' ↻' : ''}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">Budget</span>
                                  <span className="font-semibold text-indigo-500">{fmt(item.remaining)}</span>
                                </div>
                              </div>
                            );
                          }
                          const cat = getCategoryById(item.expense.categoryId);
                          const account = bankAccounts.find(a => a.id === item.expense.bankAccountId);
                          return (
                            <div key={`${item.expense.id}-${idx}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat?.color ?? '#ef4444' }} />
                                <div>
                                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.expense.name}</p>
                                  <div className="flex items-center gap-2 text-xs text-gray-400">
                                    {cat && <span>{cat.name}</span>}
                                    <span>·</span>
                                    <span>{format(item.date, 'd MMM', { locale: fr })}</span>
                                    {item.expense.isCash && <span className="text-amber-500">· Espèces</span>}
                                    {account && <span className="text-indigo-400">· {account.name}</span>}
                                    {item.expense.frequency !== 'once' && (
                                      <><span>·</span><span>{formatFrequency(item.expense.frequency)}</span></>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className="font-semibold text-red-500">{fmt(item.expense.amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <button onClick={handlePrint} className="no-print flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all">
                    <Printer className="w-4 h-4" /> Imprimer / Exporter
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ACCOUNT MODAL                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingAccount ? 'Modifier le compte' : 'Nouveau compte'}
              </h3>
              <button onClick={() => setShowAccountModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom du compte</label>
                  <input type="text" value={accountForm.name}
                    onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Compte courant BNP, Livret A..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                  <select value={accountForm.type}
                    onChange={e => setAccountForm(f => ({ ...f, type: e.target.value as any, includeInPatrimoine: e.target.value === 'livret' }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Solde actuel</label>
                  <input type="number" value={accountForm.balance}
                    onChange={e => setAccountForm(f => ({ ...f, balance: parseFloat(e.target.value) || 0 }))}
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                {(accountForm.type === 'livret' || accountForm.type === 'savings') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taux d'intérêt (%/an)</label>
                    <input type="number" value={accountForm.interestRate}
                      onChange={e => setAccountForm(f => ({ ...f, interestRate: parseFloat(e.target.value) || 0 }))}
                      step="0.01" min="0"
                      placeholder="Ex: 3.00"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {ACCOUNT_COLORS.map(c => (
                    <button key={c} onClick={() => setAccountForm(f => ({ ...f, color: c }))}
                      className={`w-8 h-8 rounded-lg transition-all ${accountForm.color === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={accountForm.showOnDashboard}
                    onChange={e => setAccountForm(f => ({ ...f, showOnDashboard: e.target.checked }))}
                    className="w-4 h-4 rounded text-indigo-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Afficher sur le tableau de bord</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox"
                    checked={accountForm.type === 'livret' ? true : accountForm.includeInPatrimoine}
                    disabled={accountForm.type === 'livret'}
                    onChange={e => setAccountForm(f => ({ ...f, includeInPatrimoine: e.target.checked }))}
                    className="w-4 h-4 rounded text-teal-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Inclure dans le Patrimoine
                    {accountForm.type === 'livret' && <span className="text-xs text-teal-500 ml-1">(automatique pour les livrets)</span>}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={accountForm.isDefault}
                    onChange={e => setAccountForm(f => ({ ...f, isDefault: e.target.checked }))}
                    className="w-4 h-4 rounded text-indigo-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Compte principal</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setShowAccountModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all">
                Annuler
              </button>
              <button
                onClick={handleSaveAccount}
                disabled={!accountForm.name.trim()}
                className="px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg transition-all font-medium"
              >
                {editingAccount ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
