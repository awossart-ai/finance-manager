import React from 'react';
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  Tag,
  Target,
  Calculator,
  Settings,
  LogOut,
  X,
  Menu,
  Briefcase,
} from 'lucide-react';
import type { AppView } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const navItems: { view: AppView; label: string; icon: React.ReactNode }[] = [
  { view: 'dashboard', label: 'Tableau de bord', icon: <LayoutDashboard className="w-5 h-5" /> },
  { view: 'expenses', label: 'Dépenses', icon: <ArrowDownCircle className="w-5 h-5" /> },
  { view: 'income', label: 'Revenus', icon: <ArrowUpCircle className="w-5 h-5" /> },
  { view: 'categories', label: 'Catégories', icon: <Tag className="w-5 h-5" /> },
  { view: 'budgets', label: 'Budgets', icon: <Target className="w-5 h-5" /> },
  { view: 'cash-calculator', label: 'Calculateur', icon: <Calculator className="w-5 h-5" /> },
  { view: 'patrimoine', label: 'Patrimoine', icon: <Briefcase className="w-5 h-5" /> },
  { view: 'settings', label: 'Paramètres', icon: <Settings className="w-5 h-5" /> },
];

export default function Sidebar({ currentView, onNavigate, isOpen, onToggle }: SidebarProps) {
  const { currentUser, logout } = useAuth();

  const initial = currentUser?.username?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            {/* Modern macOS-style icon: rounded square with "F" */}
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[10px] flex items-center justify-center shadow-md">
              <span
                className="text-white font-black select-none"
                style={{
                  fontSize: '18px',
                  lineHeight: 1,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
                  letterSpacing: '-0.02em',
                }}
              >
                F
              </span>
            </div>
            <span className="text-lg font-bold text-gray-900 dark:text-white">FinanceManager</span>
          </div>
          <button
            onClick={onToggle}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentView === item.view;
            return (
              <button
                key={item.view}
                onClick={() => {
                  onNavigate(item.view);
                  if (window.innerWidth < 1024) onToggle();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span
                  className={
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }
                >
                  {item.icon}
                </span>
                {item.label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {currentUser?.username}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {currentUser?.email}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Mobile toggle button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-20 lg:hidden p-2 bg-white dark:bg-slate-800 rounded-lg shadow-md border border-gray-200 dark:border-slate-700"
      >
        <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>
    </>
  );
}
