import React, { useState } from 'react';
import {
  Plus, Edit2, Trash2,
  Home, ShoppingCart, Car, Heart, Gamepad2, Zap, Shield,
  Tv, UtensilsCrossed, Briefcase, Laptop, TrendingUp, MoreHorizontal,
  Coffee, Music, Book, Plane, Gift, Wallet, CreditCard, Building,
  Baby, Scissors, Dumbbell, Package,
} from 'lucide-react';
import Modal from './Modal';
import { useData } from '../contexts/DataContext';
import type { Category, CategoryType } from '../types';

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#64748b',
];

const ICON_LIST = [
  { name: 'Home', icon: Home },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'Car', icon: Car },
  { name: 'Heart', icon: Heart },
  { name: 'Gamepad2', icon: Gamepad2 },
  { name: 'Zap', icon: Zap },
  { name: 'Shield', icon: Shield },
  { name: 'Tv', icon: Tv },
  { name: 'UtensilsCrossed', icon: UtensilsCrossed },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Laptop', icon: Laptop },
  { name: 'TrendingUp', icon: TrendingUp },
  { name: 'MoreHorizontal', icon: MoreHorizontal },
  { name: 'Coffee', icon: Coffee },
  { name: 'Music', icon: Music },
  { name: 'Book', icon: Book },
  { name: 'Plane', icon: Plane },
  { name: 'Gift', icon: Gift },
  { name: 'Wallet', icon: Wallet },
  { name: 'CreditCard', icon: CreditCard },
  { name: 'Building', icon: Building },
  { name: 'Baby', icon: Baby },
  { name: 'Scissors', icon: Scissors },
  { name: 'Dumbbell', icon: Dumbbell },
  { name: 'Package', icon: Package },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = Object.fromEntries(
  ICON_LIST.map(({ name, icon }) => [name, icon])
);

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? MoreHorizontal;
  return <Icon className={className} />;
}

const TYPE_LABELS: Record<CategoryType, string> = {
  expense: 'Dépense',
  income: 'Revenu',
  both: 'Les deux',
};

const TYPE_COLORS: Record<CategoryType, string> = {
  expense: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  income: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  both: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const emptyForm = () => ({
  name: '',
  color: PRESET_COLORS[0],
  icon: 'Home',
  type: 'expense' as CategoryType,
});

export default function Categories() {
  const { categories, expenses, incomes, addCategory, updateCategory, deleteCategory } = useData();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [formError, setFormError] = useState('');

  const getItemCount = (catId: string) => {
    const expCount = expenses.filter((e) => e.categoryId === catId).length;
    const incCount = incomes.filter((i) => i.categoryId === catId).length;
    return expCount + incCount;
  };

  const openAdd = () => {
    setEditingCat(null);
    setForm(emptyForm());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setForm({ name: cat.name, color: cat.color, icon: cat.icon, type: cat.type });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { setFormError('Le nom est requis.'); return; }
    setFormError('');
    if (editingCat) {
      updateCategory(editingCat.id, form);
    } else {
      addCategory(form);
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteCategory(id);
    setDeleteConfirm(null);
  };

  const deleteWarning = (id: string) => {
    const count = getItemCount(id);
    return count > 0
      ? `Cette catégorie est utilisée par ${count} élément(s). La suppression ne les supprimera pas, mais leur catégorie sera désassociée.`
      : null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {categories.length} catégorie{categories.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nouvelle catégorie
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categories.map((cat) => {
          const count = getItemCount(cat.id);
          return (
            <div
              key={cat.id}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: cat.color }}
                >
                  <CategoryIcon name={cat.icon} className="w-5 h-5" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(cat)}
                    className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(cat.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{cat.name}</h3>
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[cat.type]}`}>
                  {TYPE_LABELS[cat.type]}
                </span>
                <span className="text-xs text-gray-400">
                  {count} élément{count !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {categories.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-12 text-center border border-gray-200 dark:border-slate-700">
          <p className="text-gray-400">Aucune catégorie. Créez votre première catégorie.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCat ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
        size="md"
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
              {editingCat ? 'Enregistrer' : 'Créer'}
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

          {/* Preview */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: form.color }}
            >
              <CategoryIcon name={form.icon} className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {form.name || 'Nom de la catégorie'}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[form.type]}`}>
                {TYPE_LABELS[form.type]}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ex: Alimentation"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <div className="flex gap-2">
              {(['expense', 'income', 'both'] as CategoryType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ ...form, type: t })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border ${
                    form.type === t
                      ? 'bg-indigo-500 border-indigo-500 text-white'
                      : 'border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Couleur</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-800 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Personnalisé:</span>
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Icône</label>
            <div className="grid grid-cols-8 gap-1.5">
              {ICON_LIST.map(({ name, icon: IconComp }) => (
                <button
                  key={name}
                  onClick={() => setForm({ ...form, icon: name })}
                  className={`p-2 rounded-lg transition-all ${
                    form.icon === name
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-400'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400'
                  }`}
                  title={name}
                >
                  <IconComp className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Supprimer la catégorie"
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
              onClick={() => handleDelete(deleteConfirm!)}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all"
            >
              Supprimer
            </button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-gray-600 dark:text-gray-400">
            Êtes-vous sûr de vouloir supprimer cette catégorie ?
          </p>
          {deleteConfirm && deleteWarning(deleteConfirm) && (
            <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
              {deleteWarning(deleteConfirm)}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
