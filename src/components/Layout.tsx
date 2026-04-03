import React, { useState } from 'react';
import type { AppView } from '../types';
import Sidebar from './Sidebar';
import Header from './Header';
import Dashboard from './Dashboard';
import Expenses from './Expenses';
import Income from './Income';
import Categories from './Categories';
import Budgets from './Budgets';
import CashCalculator from './CashCalculator';
import Patrimoine from './Patrimoine';
import Settings from './Settings';

export default function Layout() {
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentView} />;
      case 'expenses': return <Expenses />;
      case 'income': return <Income />;
      case 'categories': return <Categories />;
      case 'budgets': return <Budgets />;
      case 'cash-calculator': return <CashCalculator />;
      case 'patrimoine': return <Patrimoine />;
      case 'settings': return <Settings />;
      default: return <Dashboard onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
      <Sidebar
        currentView={currentView}
        onNavigate={setCurrentView}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Header currentView={currentView} onNavigate={setCurrentView} />
        <main className="flex-1 overflow-y-auto p-6">
          {renderView()}
        </main>
      </div>
    </div>
  );
}
