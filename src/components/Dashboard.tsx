import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, PiggyBank, ChevronLeft, ChevronRight, Calendar, ArrowRight, Wallet, Printer, Settings2,
} from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getMonthlyTotals, getCategoryTotals, getBudgetProgress, getMonthTotal, formatCurrency, getOccurrences, isOccurrencePaid } from '../calculations';
import type { AppView } from '../types';

interface DashboardProps {
  onNavigate: (view: AppView) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { expenses, incomes, categories, budgets, bankAccounts, updateBankAccount } = useData();
  const { currentUser } = useAuth();
  const { currentTheme } = useTheme();
  const currency = currentUser?.settings?.currency ?? 'EUR';

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const month = selectedDate.getMonth() + 1;
  const year = selectedDate.getFullYear();
  const fmt = (n: number) => formatCurrency(n, currency);

  // KPIs
  const monthIncome = useMemo(() => getMonthTotal(incomes, month, year), [incomes, month, year]);
  const monthExpenses = useMemo(() => getMonthTotal(expenses, month, year), [expenses, month, year]);
  const balance = monthIncome - monthExpenses;
  const savingsRate = monthIncome > 0 ? ((balance / monthIncome) * 100).toFixed(1) : '0.0';

  // Accounts visible on dashboard
  const visibleAccounts = useMemo(
    () => (bankAccounts ?? []).filter(a => a.showOnDashboard !== false),
    [bankAccounts]
  );
  const totalLiquidity = useMemo(
    () => visibleAccounts.reduce((s, a) => s + a.balance, 0),
    [visibleAccounts]
  );
  const allAccounts = bankAccounts ?? [];

  // Charts
  const monthlyData = useMemo(() => getMonthlyTotals(expenses, incomes, year), [expenses, incomes, year]);
  const categoryTotals = useMemo(() => getCategoryTotals(expenses, categories, month, year), [expenses, categories, month, year]);
  const budgetProgress = useMemo(() => getBudgetProgress(expenses, budgets, categories, month, year), [expenses, budgets, categories, month, year]);

  // Upcoming expenses — unpaid occurrences only
  const upcomingExpenses = useMemo(() => {
    const now = new Date();
    const end = addMonths(now, 2);
    const items: { expense: (typeof expenses)[0]; date: Date }[] = [];
    for (const exp of expenses) {
      const occs = getOccurrences(exp, now, end);
      for (const d of occs) {
        if (!isOccurrencePaid(exp, d)) items.push({ expense: exp, date: d });
      }
    }
    return items.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5);
  }, [expenses]);

  const gridColor = currentTheme === 'dark' ? '#334155' : '#e5e7eb';
  const textColor = currentTheme === 'dark' ? '#94a3b8' : '#6b7280';
  const getCategoryById = (id: string) => categories.find(c => c.id === id);

  const kpis = [
    { label: 'Revenus du mois', value: fmt(monthIncome), icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Dépenses du mois', value: fmt(monthExpenses), icon: <TrendingDown className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: 'Solde', value: fmt(balance), icon: <DollarSign className="w-5 h-5" />, color: balance >= 0 ? 'text-indigo-500' : 'text-red-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { label: "Taux d'épargne", value: `${savingsRate}%`, icon: <PiggyBank className="w-5 h-5" />, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  ];

  return (
    <div className="space-y-6" id="dashboard-print">
      {/* Print header */}
      <div className="hidden print:flex items-center gap-3 mb-6 pb-4 border-b-2 border-indigo-500">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
          <span className="text-white font-black text-lg">F</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Finance Manager</h1>
          <p className="text-sm text-gray-500">Tableau de bord — {format(selectedDate, 'MMMM yyyy', { locale: fr })}</p>
        </div>
      </div>

      {/* Month selector + print */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedDate(d => subMonths(d, 1))} className="no-print p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-all">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <span className="text-lg font-semibold text-gray-900 dark:text-white capitalize min-w-[180px] text-center">
            {format(selectedDate, 'MMMM yyyy', { locale: fr })}
          </span>
          <button onClick={() => setSelectedDate(d => addMonths(d, 1))} className="no-print p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-all">
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <button onClick={() => window.print()} className="no-print flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all">
          <Printer className="w-4 h-4" /> Exporter PDF
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">{kpi.label}</span>
              <div className={`p-2 rounded-lg ${kpi.bg}`}><span className={kpi.color}>{kpi.icon}</span></div>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Liquidity strip */}
      {allAccounts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Liquidités</h2>
              {allAccounts.length > 0 && (
                <span className="text-xs text-gray-400">
                  ({visibleAccounts.length}/{allAccounts.length} comptes affichés)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                onClick={() => setShowAccountPicker(!showAccountPicker)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Sélectionner
              </button>
              <button onClick={() => onNavigate('cash-calculator')} className="text-sm text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                Gérer <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Account picker */}
          {showAccountPicker && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl space-y-2">
              <p className="text-xs text-gray-500 font-medium mb-2">Comptes à afficher sur le tableau de bord</p>
              {allAccounts.map(acc => (
                <label key={acc.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acc.showOnDashboard !== false}
                    onChange={e => updateBankAccount(acc.id, { showOnDashboard: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-500"
                  />
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: acc.color }} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{acc.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{fmt(acc.balance)}</span>
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            {visibleAccounts.map(acc => (
              <div key={acc.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{acc.name}</span>
                <span className={`text-sm font-semibold ${acc.balance >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-500'}`}>
                  {fmt(acc.balance)}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <span className="text-sm text-indigo-600 dark:text-indigo-400 font-medium">Total</span>
              <span className={`text-sm font-bold ${totalLiquidity >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500'}`}>
                {fmt(totalLiquidity)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Revenus vs Dépenses — {year}</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: textColor, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}€`} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#fff', border: `1px solid ${currentTheme === 'dark' ? '#334155' : '#e5e7eb'}`, borderRadius: '0.75rem', color: currentTheme === 'dark' ? '#f1f5f9' : '#111827' }} />
              <Legend />
              <Area type="monotone" dataKey="income" name="Revenus" stroke="#22c55e" fill="url(#incomeGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" name="Dépenses" stroke="#ef4444" fill="url(#expenseGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Dépenses par catégorie</h2>
          {categoryTotals.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Aucune dépense ce mois</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryTotals} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {categoryTotals.map(e => <Cell key={e.categoryId} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: currentTheme === 'dark' ? '#1e293b' : '#fff', border: `1px solid ${currentTheme === 'dark' ? '#334155' : '#e5e7eb'}`, borderRadius: '0.75rem' }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Upcoming */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Prochaines échéances</h2>
            <button onClick={() => onNavigate('expenses')} className="no-print text-sm text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
              Voir tout <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {upcomingExpenses.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune échéance à venir.</p>
          ) : (
            <div className="space-y-3">
              {upcomingExpenses.map(({ expense, date }, i) => {
                const cat = getCategoryById(expense.categoryId);
                return (
                  <div key={`${expense.id}-${i}`} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat?.color ?? '#6366f1' }} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{expense.name}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          {format(date, 'd MMM yyyy', { locale: fr })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-500">{fmt(expense.amount)}</p>
                      <div className="flex items-center gap-1 justify-end">
                        {expense.isCash && <span className="text-xs text-amber-500">Espèces</span>}
                        <span className="text-xs text-red-400">Impayé</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Budget overview */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Aperçu budgets</h2>
            <button onClick={() => onNavigate('budgets')} className="no-print text-sm text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
              Voir tout <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {budgetProgress.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucun budget défini pour ce mois.</p>
          ) : (
            <div className="space-y-3">
              {budgetProgress.slice(0, 5).map(bp => {
                const pct = Math.min(bp.percentage, 100);
                const barColor = bp.percentage >= 90 ? 'bg-red-500' : bp.percentage >= 75 ? 'bg-amber-500' : 'bg-emerald-500';
                return (
                  <div key={bp.budget.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{bp.category?.name}</span>
                      <span className="text-gray-500 dark:text-gray-400">{fmt(bp.actual)} / {fmt(bp.budget.amount)}</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
