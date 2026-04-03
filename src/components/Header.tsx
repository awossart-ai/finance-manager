import React, { useState } from 'react';
import { Sun, Moon, Laptop, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AppView } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

interface HeaderProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

const viewTitles: Record<AppView, string> = {
  dashboard: 'Tableau de bord',
  expenses: 'Dépenses',
  income: 'Revenus',
  categories: 'Catégories',
  budgets: 'Budgets',
  'cash-calculator': 'Calculateur de liquidités',
  patrimoine: 'Patrimoine',
  settings: 'Paramètres',
};

export default function Header({ currentView, onNavigate }: HeaderProps) {
  const { currentUser, logout } = useAuth();
  const { currentTheme, themeMode, setThemeMode } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const cycleTheme = () => {
    if (themeMode === 'light') setThemeMode('dark');
    else if (themeMode === 'dark') setThemeMode('auto');
    else setThemeMode('light');
  };

  const ThemeIcon =
    themeMode === 'light' ? Sun : themeMode === 'dark' ? Moon : Laptop;

  const themeLabel =
    themeMode === 'light' ? 'Clair' : themeMode === 'dark' ? 'Sombre' : 'Auto';

  const initial = currentUser?.username?.charAt(0)?.toUpperCase() ?? '?';
  const today = format(new Date(), 'EEEE d MMMM yyyy', { locale: fr });

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {viewTitles[currentView]}
        </h1>
        <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{today}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={cycleTheme}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all text-sm"
          title={`Thème: ${themeLabel}`}
        >
          <ThemeIcon className="w-4 h-4" />
          <span className="hidden sm:inline">{themeLabel}</span>
        </button>

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {initial}
            </div>
            <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300">
              {currentUser?.username}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 z-20 py-1">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-slate-700">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {currentUser?.username}
                  </p>
                  <p className="text-xs text-gray-400">{currentUser?.email}</p>
                </div>
                <button
                  onClick={() => {
                    onNavigate('settings');
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                >
                  <Settings className="w-4 h-4" />
                  Paramètres
                </button>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="w-4 h-4" />
                  Se déconnecter
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
