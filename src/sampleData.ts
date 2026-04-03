import { v4 as uuidv4 } from 'uuid';
import { format, subMonths, addMonths } from 'date-fns';
import type { UserData, Category, Expense, Income, Budget } from './types';

export function createSampleData(userId: string): UserData {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Categories
  const categories: Category[] = [
    { id: uuidv4(), name: 'Logement', color: '#6366f1', icon: 'Home', type: 'expense', userId },
    { id: uuidv4(), name: 'Alimentation', color: '#f59e0b', icon: 'ShoppingCart', type: 'expense', userId },
    { id: uuidv4(), name: 'Transport', color: '#3b82f6', icon: 'Car', type: 'expense', userId },
    { id: uuidv4(), name: 'Santé', color: '#ef4444', icon: 'Heart', type: 'expense', userId },
    { id: uuidv4(), name: 'Loisirs', color: '#8b5cf6', icon: 'Gamepad2', type: 'expense', userId },
    { id: uuidv4(), name: 'Énergie', color: '#f97316', icon: 'Zap', type: 'expense', userId },
    { id: uuidv4(), name: 'Assurance', color: '#06b6d4', icon: 'Shield', type: 'expense', userId },
    { id: uuidv4(), name: 'Abonnements', color: '#ec4899', icon: 'Tv', type: 'expense', userId },
    { id: uuidv4(), name: 'Restaurant', color: '#84cc16', icon: 'UtensilsCrossed', type: 'expense', userId },
    { id: uuidv4(), name: 'Salaire', color: '#22c55e', icon: 'Briefcase', type: 'income', userId },
    { id: uuidv4(), name: 'Freelance', color: '#14b8a6', icon: 'Laptop', type: 'income', userId },
    { id: uuidv4(), name: 'Investissements', color: '#a855f7', icon: 'TrendingUp', type: 'both', userId },
    { id: uuidv4(), name: 'Divers', color: '#64748b', icon: 'MoreHorizontal', type: 'both', userId },
  ];

  const catByName = (name: string) => categories.find((c) => c.name === name)!.id;

  const firstOfMonth = (offset = 0) =>
    format(addMonths(new Date(currentYear, currentMonth - 1, 1), offset), 'yyyy-MM-dd');
  const dayOfMonth = (day: number, offset = 0) =>
    format(addMonths(new Date(currentYear, currentMonth - 1, day), offset), 'yyyy-MM-dd');

  const ts = now.toISOString();

  // Expenses
  const expenses: Expense[] = [
    {
      id: uuidv4(),
      userId,
      name: 'Loyer',
      amount: 950,
      categoryId: catByName('Logement'),
      frequency: 'monthly',
      dueDate: firstOfMonth(),
      isRecurring: true,
      isCash: false,
      status: 'paid',
      notes: 'Loyer appartement T3',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'EDF / Électricité',
      amount: 85,
      categoryId: catByName('Énergie'),
      frequency: 'monthly',
      dueDate: dayOfMonth(10),
      isRecurring: true,
      isCash: false,
      status: 'unpaid',
      notes: '',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Courses alimentaires',
      amount: 450,
      categoryId: catByName('Alimentation'),
      frequency: 'monthly',
      dueDate: dayOfMonth(1),
      isRecurring: true,
      isCash: true,
      status: 'unpaid',
      notes: 'Budget mensuel courses',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Abonnement Netflix',
      amount: 17.99,
      categoryId: catByName('Abonnements'),
      frequency: 'monthly',
      dueDate: dayOfMonth(15),
      isRecurring: true,
      isCash: false,
      status: 'paid',
      notes: '',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Abonnement Spotify',
      amount: 9.99,
      categoryId: catByName('Abonnements'),
      frequency: 'monthly',
      dueDate: dayOfMonth(5),
      isRecurring: true,
      isCash: false,
      status: 'paid',
      notes: '',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Assurance voiture',
      amount: 75,
      categoryId: catByName('Assurance'),
      frequency: 'monthly',
      dueDate: dayOfMonth(20),
      isRecurring: true,
      isCash: false,
      status: 'unpaid',
      notes: 'AXA',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Plein d\'essence',
      amount: 60,
      categoryId: catByName('Transport'),
      frequency: 'biweekly',
      dueDate: dayOfMonth(1),
      isRecurring: true,
      isCash: true,
      status: 'unpaid',
      notes: '',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Mutuelle santé',
      amount: 45,
      categoryId: catByName('Santé'),
      frequency: 'monthly',
      dueDate: dayOfMonth(1),
      isRecurring: true,
      isCash: false,
      status: 'paid',
      notes: '',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Salle de sport',
      amount: 35,
      categoryId: catByName('Loisirs'),
      frequency: 'monthly',
      dueDate: dayOfMonth(1),
      isRecurring: true,
      isCash: false,
      status: 'paid',
      notes: '',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Restaurant du week-end',
      amount: 35,
      categoryId: catByName('Restaurant'),
      frequency: 'weekly',
      dueDate: dayOfMonth(7),
      isRecurring: true,
      isCash: true,
      status: 'unpaid',
      notes: '',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Assurance habitation',
      amount: 180,
      categoryId: catByName('Assurance'),
      frequency: 'annual',
      dueDate: format(new Date(currentYear, 2, 1), 'yyyy-MM-dd'),
      isRecurring: true,
      isCash: false,
      status: 'unpaid',
      notes: 'MAIF',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Contrôle technique',
      amount: 75,
      categoryId: catByName('Transport'),
      frequency: 'once',
      dueDate: dayOfMonth(15, 1),
      isRecurring: false,
      isCash: false,
      status: 'unpaid',
      notes: '',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
  ];

  // Incomes
  const incomes: Income[] = [
    {
      id: uuidv4(),
      userId,
      name: 'Salaire net',
      amount: 2800,
      categoryId: catByName('Salaire'),
      frequency: 'monthly',
      date: dayOfMonth(28),
      isRecurring: true,
      status: 'expected',
      receivedOccurrences: [],
      notes: 'Entreprise XYZ',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Mission freelance',
      amount: 500,
      categoryId: catByName('Freelance'),
      frequency: 'monthly',
      date: dayOfMonth(15),
      isRecurring: true,
      status: 'expected',
      receivedOccurrences: [],
      notes: 'Client A',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Dividendes',
      amount: 250,
      categoryId: catByName('Investissements'),
      frequency: 'quarterly',
      date: format(new Date(currentYear, 0, 15), 'yyyy-MM-dd'),
      isRecurring: true,
      status: 'expected',
      receivedOccurrences: [],
      notes: 'Portefeuille boursier',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: uuidv4(),
      userId,
      name: 'Remboursement impôts',
      amount: 320,
      categoryId: catByName('Divers'),
      frequency: 'once',
      date: format(new Date(currentYear, 6, 20), 'yyyy-MM-dd'),
      isRecurring: false,
      status: 'expected',
      receivedOccurrences: [],
      notes: '',
      documents: [],
      createdAt: ts,
      updatedAt: ts,
    },
  ];

  // Budgets (monthly for current month + next 2 months)
  const budgets: Budget[] = [];
  for (let offset = 0; offset < 3; offset++) {
    const targetDate = addMonths(new Date(currentYear, currentMonth - 1, 1), offset);
    const m = targetDate.getMonth() + 1;
    const y = targetDate.getFullYear();

    const monthBudgets = [
      { categoryId: catByName('Logement'), amount: 1000 },
      { categoryId: catByName('Alimentation'), amount: 500 },
      { categoryId: catByName('Transport'), amount: 150 },
      { categoryId: catByName('Loisirs'), amount: 100 },
      { categoryId: catByName('Énergie'), amount: 100 },
      { categoryId: catByName('Abonnements'), amount: 50 },
    ];

    for (const b of monthBudgets) {
      budgets.push({
        id: uuidv4(),
        userId,
        categoryId: b.categoryId,
        amount: b.amount,
        periodType: 'monthly',
        month: m,
        year: y,
        createdAt: ts,
        updatedAt: ts,
      });
    }
  }

  // Annual budgets
  const annualBudgets = [
    { categoryId: catByName('Assurance'), amount: 1500 },
    { categoryId: catByName('Santé'), amount: 800 },
    { categoryId: catByName('Loisirs'), amount: 1200 },
  ];

  for (const b of annualBudgets) {
    budgets.push({
      id: uuidv4(),
      userId,
      categoryId: b.categoryId,
      amount: b.amount,
      periodType: 'annual',
      year: currentYear,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  return { categories, expenses, incomes, budgets, bankAccounts: [], patrimoineAssets: [] };
}
