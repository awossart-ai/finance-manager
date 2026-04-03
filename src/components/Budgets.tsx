import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Copy, Printer, RefreshCw, Receipt } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { getBudgetProgress, getAnnualBudgetProgress, formatCurrency } from '../calculations';
import type { Budget, BudgetPeriodType, BankAccount } from '../types';
import { v4 as uuidv4 } from 'uuid';

export default function Budgets() {
  const { categories, expenses, budgets, bankAccounts, addBudget, updateBudget, deleteBudget } = useData();
  const { currentUser } = useAuth();
  const currency = currentUser?.settings?.currency ?? 'EUR';
  const fmt = (n: number) => formatCurrency(n, currency);

  const [periodType, setPeriodType] = useState<BudgetPeriodType>('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const month = selectedDate.getMonth() + 1;
  const year = selectedDate.getFullYear();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [form, setForm] = useState({
    categoryId: '',
    amount: 0,
    periodType: 'monthly' as BudgetPeriodType,
    month: month,
    year: year,
    isRecurring: false,
    repeatUntil: '',
    showAsExpense: false,
    bankAccountId: '',
  });
  const [formError, setFormError] = useState('');

  const expenseCategories = categories.filter(
    (c) => c.type === 'expense' || c.type === 'both'
  );

  const progress = useMemo(() => {
    if (periodType === 'monthly') {
      return getBudgetProgress(expenses, budgets, categories, month, year);
    } else {
      return getAnnualBudgetProgress(expenses, budgets, categories, year);
    }
  }, [expenses, budgets, categories, month, year, periodType]);

  const totalBudgeted = progress.reduce((s, bp) => s + bp.budget.amount, 0);
  const totalSpent = progress.reduce((s, bp) => s + bp.actual, 0);
  const globalPct = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  const openAdd = () => {
    setEditingBudget(null);
    setForm({ categoryId: '', amount: 0, periodType, month, year, isRecurring: false, repeatUntil: '', showAsExpense: false, bankAccountId: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (b: Budget) => {
    setEditingBudget(b);
    setForm({
      categoryId: b.categoryId,
      amount: b.amount,
      periodType: b.periodType,
      month: b.month ?? month,
      year: b.year,
      isRecurring: b.isRecurring ?? false,
      repeatUntil: b.repeatUntil ?? '',
      showAsExpense: b.showAsExpense ?? false,
      bankAccountId: b.bankAccountId ?? '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.categoryId) { setFormError('La catégorie est requise.'); return; }
    if (form.amount <= 0) { setFormError('Le montant doit être positif.'); return; }
    setFormError('');
    const data = {
      categoryId: form.categoryId,
      amount: form.amount,
      periodType: form.periodType,
      month: form.periodType === 'monthly' ? form.month : undefined,
      year: form.year,
      isRecurring: form.periodType === 'monthly' ? form.isRecurring : false,
      repeatUntil: form.periodType === 'monthly' && form.isRecurring && form.repeatUntil ? form.repeatUntil : undefined,
      showAsExpense: form.showAsExpense,
      bankAccountId: form.bankAccountId || undefined,
    };
    if (editingBudget) {
      updateBudget(editingBudget.id, data);
    } else {
      addBudget(data);
    }
    setModalOpen(false);
  };

  const copyFromPrevMonth = () => {
    const prevDate = subMonths(selectedDate, 1);
    const prevMonth = prevDate.getMonth() + 1;
    const prevYear = prevDate.getFullYear();
    const prevBudgets = budgets.filter(
      (b) => b.periodType === 'monthly' && b.month === prevMonth && b.year === prevYear
    );
    const ts = new Date().toISOString();
    for (const b of prevBudgets) {
      const exists = budgets.find(
        (ex) => ex.periodType === 'monthly' && ex.month === month && ex.year === year && ex.categoryId === b.categoryId
      );
      if (!exists) {
        addBudget({
          categoryId: b.categoryId,
          amount: b.amount,
          periodType: 'monthly',
          month,
          year,
        });
      }
    }
  };

  const barColor = (pct: number) =>
    pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-slate-700 flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-slate-600">
          <button
            onClick={() => setPeriodType('monthly')}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              periodType === 'monthly'
                ? 'bg-indigo-500 text-white'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setPeriodType('annual')}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              periodType === 'annual'
                ? 'bg-indigo-500 text-white'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            Annuel
          </button>
        </div>

        {periodType === 'monthly' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate((d) => subMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="font-semibold text-gray-900 dark:text-white capitalize min-w-[150px] text-center">
              {format(selectedDate, 'MMMM yyyy', { locale: fr })}
            </span>
            <button
              onClick={() => setSelectedDate((d) => addMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDate(new Date(year - 1, 0, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="font-semibold text-gray-900 dark:text-white min-w-[60px] text-center">{year}</span>
            <button
              onClick={() => setSelectedDate(new Date(year + 1, 0, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-all"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        )}

        <div className="ml-auto flex gap-2">
          {periodType === 'monthly' && (
            <button
              onClick={copyFromPrevMonth}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
            >
              <Copy className="w-4 h-4" />
              Copier du mois précédent
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="no-print flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Summary */}
      {progress.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Budget global</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {fmt(totalSpent)} / {fmt(totalBudgeted)} ({globalPct.toFixed(1)}%)
            </span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor(globalPct)}`}
              style={{ width: `${Math.min(globalPct, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Catégorie</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Budget</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Dépensé</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Reste</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide min-w-[150px]">Progression</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {progress.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    Aucun budget défini pour cette période.
                  </td>
                </tr>
              ) : (
                progress.map((bp) => {
                  const pct = Math.min(bp.percentage, 100);
                  const remaining = bp.budget.amount - bp.actual;
                  return (
                    <tr
                      key={bp.budget.id}
                      className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: bp.category?.color ?? '#6366f1' }}
                          />
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {bp.category?.name ?? '—'}
                          </span>
                          {bp.budget.isRecurring && (
                            <span title={bp.budget.repeatUntil ? `Jusqu'au ${format(new Date(bp.budget.repeatUntil), 'MMM yyyy', { locale: fr })}` : 'Récurrent sans fin'}>
                              <RefreshCw className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            </span>
                          )}
                          {bp.budget.showAsExpense && (
                            <span title="Affiché comme dépense à venir">
                              <Receipt className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                        {fmt(bp.budget.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${bp.percentage >= 90 ? 'text-red-500' : bp.percentage >= 75 ? 'text-amber-500' : 'text-gray-700 dark:text-gray-300'}`}>
                          {fmt(bp.actual)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-medium ${remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                          {fmt(Math.abs(remaining))} {remaining < 0 ? 'dépassé' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${barColor(bp.percentage)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[40px] text-right">
                            {bp.percentage.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(bp.budget)}
                            className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(bp.budget.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBudget ? 'Modifier le budget' : 'Nouveau budget'}
        size="sm"
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all"
            >
              {editingBudget ? 'Enregistrer' : 'Ajouter'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {formError}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catégorie</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Sélectionner...</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Montant budgété</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount || ''}
              onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-slate-600">
              <button
                onClick={() => setForm({ ...form, periodType: 'monthly' })}
                className={`flex-1 py-2 text-sm font-medium transition-all ${form.periodType === 'monthly' ? 'bg-indigo-500 text-white' : 'text-gray-600 dark:text-gray-400'}`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setForm({ ...form, periodType: 'annual' })}
                className={`flex-1 py-2 text-sm font-medium transition-all ${form.periodType === 'annual' ? 'bg-indigo-500 text-white' : 'text-gray-600 dark:text-gray-400'}`}
              >
                Annuel
              </button>
            </div>
          </div>
          {form.periodType === 'monthly' && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isRecurring}
                  onChange={(e) => setForm({ ...form, isRecurring: e.target.checked, repeatUntil: '' })}
                  className="w-4 h-4 rounded text-indigo-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                  Répéter automatiquement chaque mois
                </span>
              </label>
              {form.isRecurring && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Répéter jusqu'au (optionnel)</label>
                  <input
                    type="month"
                    value={form.repeatUntil ? form.repeatUntil.slice(0, 7) : ''}
                    onChange={(e) => setForm({ ...form, repeatUntil: e.target.value ? `${e.target.value}-01` : '' })}
                    className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {!form.repeatUntil && <p className="text-xs text-gray-400 mt-1">Vide = répétition sans fin</p>}
                </div>
              )}
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showAsExpense}
              onChange={(e) => setForm({ ...form, showAsExpense: e.target.checked })}
              className="w-4 h-4 rounded text-amber-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              Afficher le restant comme dépense à venir
            </span>
          </label>
          {form.showAsExpense && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compte associé</label>
              <select
                value={form.bankAccountId}
                onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Non spécifié</option>
                {bankAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}
          {form.periodType === 'monthly' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mois</label>
                <select
                  value={form.month}
                  onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {format(new Date(2024, i, 1), 'MMMM', { locale: fr })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Année</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}
          {form.periodType === 'annual' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Année</label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Supprimer le budget"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
            >
              Annuler
            </button>
            <button
              onClick={() => { if (deleteConfirm) deleteBudget(deleteConfirm); setDeleteConfirm(null); }}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
            >
              Supprimer
            </button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">Êtes-vous sûr de vouloir supprimer ce budget ?</p>
      </Modal>
    </div>
  );
}
