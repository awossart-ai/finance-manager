import React, { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle,
  Circle,
  Paperclip,
  X,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import {
  formatCurrency,
  formatFrequency,
  isIncomeOccurrenceReceived,
  getOccurrences,
  parseLocalDate,
  getOccurrenceAmount,
} from '../calculations';
import type { Income as IncomeType, AppDocument } from '../types';

const FREQUENCIES = ['once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual'] as const;

const emptyForm = (): Omit<IncomeType, 'id' | 'userId' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  amount: 0,
  categoryId: '',
  bankAccountId: undefined,
  frequency: 'monthly',
  date: format(new Date(), 'yyyy-MM-dd'),
  endDate: undefined,
  isRecurring: false,
  status: 'expected',
  receivedOccurrences: [],
  amountOverrides: {},
  notes: '',
  documents: [],
});

export default function Income() {
  const { incomes, categories, bankAccounts, addIncome, updateIncome, deleteIncome, toggleReceived } = useData();
  const { currentUser } = useAuth();
  const currency = currentUser?.settings?.currency ?? 'EUR';
  const fmt = (n: number) => formatCurrency(n, currency);

  const [selectedDate, setSelectedDate] = useState(() => startOfMonth(new Date()));
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingIncome, setEditingIncome] = useState<IncomeType | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const incomeCategories = categories.filter(
    (c) => c.type === 'income' || c.type === 'both'
  );

  const filtered = useMemo(() => {
    const monthStart = startOfMonth(selectedDate);
    const monthEnd = endOfMonth(selectedDate);
    return incomes.filter((i) => {
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && i.categoryId !== filterCategory) return false;
      // Only show if there is an occurrence in the selected month
      const occs = getOccurrences(i as any, monthStart, monthEnd);
      if (occs.length === 0) return false;
      return true;
    });
  }, [incomes, search, filterCategory, selectedDate]);

  const openAdd = () => {
    setEditingIncome(null);
    setForm(emptyForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (inc: IncomeType) => {
    setEditingIncome(inc);
    setForm({
      name: inc.name,
      amount: inc.amount,
      categoryId: inc.categoryId,
      bankAccountId: inc.bankAccountId,
      frequency: inc.frequency,
      date: inc.date,
      endDate: inc.endDate,
      isRecurring: inc.isRecurring,
      status: inc.status ?? 'expected',
      receivedOccurrences: inc.receivedOccurrences ?? [],
      amountOverrides: inc.amountOverrides ?? {},
      notes: inc.notes ?? '',
      documents: inc.documents ?? [],
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { setFormError('Le nom est requis.'); return; }
    if (form.amount <= 0) { setFormError('Le montant doit être positif.'); return; }
    if (!form.date) { setFormError('La date est requise.'); return; }
    setFormError('');
    if (editingIncome) {
      updateIncome(editingIncome.id, form);
    } else {
      addIncome(form);
    }
    setModalOpen(false);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    const newDocs: AppDocument[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) continue;
      const data = await fileToBase64(file);
      newDocs.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        data,
        uploadedAt: new Date().toISOString(),
      });
    }
    setForm((f) => ({ ...f, documents: [...f.documents, ...newDocs] }));
  };

  const removeDoc = (docId: string) => {
    setForm((f) => ({ ...f, documents: f.documents.filter((d) => d.id !== docId) }));
  };

  const getCategoryById = (id: string) => categories.find((c) => c.id === id);
  const getBankAccountById = (id?: string) => (bankAccounts ?? []).find((a) => a.id === id);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-slate-700 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-transparent text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Toutes catégories</option>
          {incomeCategories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
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

      {/* Month navigator */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setSelectedDate((d) => startOfMonth(addMonths(d, -1)))}
          className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 min-w-[120px] text-center">
          {format(selectedDate, 'MMMM yyyy', { locale: fr })}
        </span>
        <button
          onClick={() => setSelectedDate((d) => startOfMonth(addMonths(d, 1)))}
          className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nom</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Catégorie</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Montant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Fréquence</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Compte</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Statut</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    Aucun revenu trouvé.
                  </td>
                </tr>
              ) : (
                filtered.map((inc) => {
                  const cat = getCategoryById(inc.categoryId);
                  const isRecurring = inc.isRecurring && inc.frequency !== 'once';
                  const selectedMonthStr = format(selectedDate, 'yyyy-MM');
                  // Find occurrence(s) in the selected month
                  const occs = getOccurrences(inc as any, startOfMonth(selectedDate), endOfMonth(selectedDate));
                  const hasOccurrence = occs.length > 0;
                  const occDate = occs[0] ?? null;
                  const displayDate = occDate
                    ? format(occDate, 'd MMM yyyy', { locale: fr })
                    : format(parseLocalDate(inc.date), 'd MMM yyyy', { locale: fr });
                  const showStatus = isRecurring || hasOccurrence;
                  const received = showStatus ? isIncomeOccurrenceReceived(inc, occDate ?? selectedDate) : false;
                  return (
                    <tr
                      key={inc.id}
                      className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {inc.name}
                          </span>
                          {inc.documents.length > 0 && <Paperclip className="w-3.5 h-3.5 text-gray-400" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {cat ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: cat.color }}
                          >
                            {cat.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-emerald-500">
                          {fmt(getOccurrenceAmount(inc, occDate ?? selectedDate))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {displayDate}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {formatFrequency(inc.frequency)}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const acc = getBankAccountById(inc.bankAccountId);
                          return acc ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: acc.color }}>
                              {acc.name}
                            </span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {showStatus ? (
                          <button
                            onClick={() => toggleReceived(inc.id, isRecurring ? selectedMonthStr : undefined)}
                            className="inline-flex items-center justify-center gap-1 text-xs font-medium transition-all w-28"
                            title={`Marquer ${selectedMonthStr} comme ${received ? 'non reçu' : 'reçu'}`}
                          >
                            {received ? (
                              <span className="flex items-center gap-1 text-emerald-500">
                                <CheckCircle className="w-4 h-4" /> Reçu
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-500">
                                <Circle className="w-4 h-4" /> En attente
                              </span>
                            )}
                          </button>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(inc)}
                            className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(inc.id)}
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
        <div className="px-4 py-3 border-t border-gray-200 dark:border-slate-700 text-sm text-gray-400">
          {filtered.length} revenu{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingIncome ? 'Modifier le revenu' : 'Nouveau revenu'}
        size="lg"
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
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all"
            >
              {editingIncome ? 'Enregistrer' : 'Ajouter'}
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
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="ex: Salaire"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Montant{editingIncome && form.isRecurring && form.frequency !== 'once' ? ' (toutes les échéances)' : ''}
              </label>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catégorie</label>
              <select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sélectionner...</option>
                {incomeCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compte à créditer</label>
              <select
                value={form.bankAccountId ?? ''}
                onChange={(e) => setForm({ ...form, bankAccountId: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Non spécifié</option>
                {(bankAccounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fréquence</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as typeof form.frequency })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{formatFrequency(f)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="col-span-2 flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setForm({ ...form, isRecurring: !form.isRecurring })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${form.isRecurring ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isRecurring ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Récurrent</span>
              </label>
              {!form.isRecurring && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setForm({ ...form, status: form.status === 'received' ? 'expected' : 'received' })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.status === 'received' ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.status === 'received' ? 'translate-x-5' : ''}`} />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Reçu</span>
                </label>
              )}
            </div>
            {form.isRecurring && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date de fin (optionnel)</label>
                <input
                  type="date"
                  value={form.endDate ?? ''}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value || undefined })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
            {editingIncome && form.isRecurring && form.frequency !== 'once' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Montant exceptionnel — {format(selectedDate, 'MMMM yyyy', { locale: fr })}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amountOverrides?.[format(selectedDate, 'yyyy-MM')] ?? ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const key = format(selectedDate, 'yyyy-MM');
                    const overrides = { ...(form.amountOverrides ?? {}) };
                    if (isNaN(val) || e.target.value === '') {
                      delete overrides[key];
                    } else {
                      overrides[key] = val;
                    }
                    setForm({ ...form, amountOverrides: overrides });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={`Laisser vide pour ${fmt(form.amount)}`}
                />
                <p className="text-xs text-gray-400 mt-1">S'applique uniquement à cette échéance.</p>
              </div>
            )}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Notes optionnelles..."
              />
            </div>
            {/* Documents */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Documents</label>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-all w-full justify-center"
              >
                <Paperclip className="w-4 h-4" />
                Ajouter des fichiers (max 5MB)
              </button>
              {form.documents.length > 0 && (
                <div className="mt-2 space-y-2">
                  {form.documents.map((doc) => (
                    <DocumentItem key={doc.id} doc={doc} onRemove={removeDoc} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Supprimer le revenu"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
            >
              Annuler
            </button>
            <button
              onClick={() => { if (deleteConfirm) deleteIncome(deleteConfirm); setDeleteConfirm(null); }}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all"
            >
              Supprimer
            </button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Êtes-vous sûr de vouloir supprimer ce revenu ? Cette action est irréversible.
        </p>
      </Modal>
    </div>
  );
}

function DocumentItem({ doc, onRemove }: { doc: AppDocument; onRemove: (id: string) => void }) {
  const isImage = doc.type.startsWith('image/');

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = doc.data;
    a.download = doc.name;
    a.click();
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-slate-700 rounded-lg">
      {isImage && (
        <img src={doc.data} alt={doc.name} className="w-10 h-10 object-cover rounded" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{doc.name}</p>
        <p className="text-xs text-gray-400">{(doc.size / 1024).toFixed(1)} KB</p>
      </div>
      <button onClick={handleDownload} className="p-1 text-gray-400 hover:text-indigo-500 transition-all">
        <Download className="w-4 h-4" />
      </button>
      <button onClick={() => onRemove(doc.id)} className="p-1 text-gray-400 hover:text-red-500 transition-all">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
