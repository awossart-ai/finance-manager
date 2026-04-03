export type ThemeMode = 'dark' | 'light' | 'auto';
export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF' | 'CAD';
export type Frequency = 'once' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
export type CategoryType = 'expense' | 'income' | 'both';
export type AppView = 'dashboard' | 'expenses' | 'income' | 'categories' | 'budgets' | 'cash-calculator' | 'patrimoine' | 'settings';
export type TransactionStatus = 'paid' | 'unpaid';
export type BudgetPeriodType = 'monthly' | 'annual';
export type PatrimoineType = 'PEA' | 'CTO' | 'crypto' | 'crowdfunding' | 'immobilier' | 'autre';
export type BankAccountType = 'checking' | 'savings' | 'livret' | 'cash' | 'other';
export type DividendMode = 'auto' | 'manual';
export type DividendFrequency = 'monthly' | 'quarterly' | 'semi-annual' | 'annual';

export interface UserSettings {
  theme: ThemeMode;
  currency: CurrencyCode;
  location?: {
    lat: number;
    lon: number;
    name: string;
  };
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  settings: UserSettings;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: CategoryType;
  userId: string;
}

export interface AppDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  data: string; // base64
  uploadedAt: string;
}

export interface BankAccount {
  id: string;
  userId: string;
  name: string;
  balance: number;
  color: string;
  type: BankAccountType;
  isDefault: boolean;
  showOnDashboard: boolean;
  includeInPatrimoine: boolean; // livrets etc.
  interestRate?: number; // % annuel (livrets)
  createdAt: string;
  updatedAt: string;
}

export interface DividendInfo {
  mode: DividendMode;
  amountPerShare?: number;   // montant nominal par action par an
  frequency?: DividendFrequency;
  totalAnnual?: number;      // total annuel (calculé ou saisi)
  yieldPct?: number;         // rendement % (fallback auto)
  lastFetched?: string;      // ISO date dernière récupération auto
}

export interface PatrimoineHolding {
  id: string;
  ticker: string;
  name: string;
  isin?: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  currency?: string;
  dividend?: DividendInfo;
  lastUpdated?: string;
}

export interface PatrimoineAsset {
  id: string;
  userId: string;
  type: PatrimoineType;
  name: string;
  holdings: PatrimoineHolding[];
  manualValue?: number;
  manualInvested?: number;
  taxRate?: number;          // null = pas de fiscalité, 0.314 = PFU par défaut
  applyTax: boolean;         // activer/désactiver la fiscalité sur cet actif
  notes?: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  userId: string;
  name: string;
  amount: number;
  categoryId: string;
  bankAccountId?: string;
  frequency: Frequency;
  dueDate: string;
  endDate?: string;
  isRecurring: boolean;
  isCash: boolean;
  status: TransactionStatus; // utilisé uniquement pour les dépenses non-récurrentes
  paidOccurrences?: string[]; // mois payés pour les dépenses récurrentes ex: ['2025-04', '2025-05']
  amountOverrides?: Record<string, number>; // montant exceptionnel par mois ex: {'2026-04': 850}
  notes?: string;
  documents: AppDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface Income {
  id: string;
  userId: string;
  name: string;
  amount: number;
  categoryId: string;
  bankAccountId?: string;           // compte à créditer
  frequency: Frequency;
  date: string;
  endDate?: string;
  isRecurring: boolean;
  status: 'received' | 'expected';  // pour les revenus ponctuels
  receivedOccurrences?: string[];   // mois reçus pour les récurrents ex: ['2026-04']
  amountOverrides?: Record<string, number>; // montant exceptionnel par mois
  notes?: string;
  documents: AppDocument[];
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  periodType: BudgetPeriodType;
  month?: number;
  year: number;
  isRecurring?: boolean;   // se répète chaque mois automatiquement
  repeatUntil?: string;    // ISO date (YYYY-MM-DD) - undefined = sans fin
  showAsExpense?: boolean; // afficher le restant comme dépense à venir dans Dépenses et calculateur
  bankAccountId?: string;  // compte associé (affiché dans la ligne dépense budget)
  createdAt: string;
  updatedAt: string;
}

export interface UserData {
  categories: Category[];
  expenses: Expense[];
  incomes: Income[];
  budgets: Budget[];
  bankAccounts: BankAccount[];
  patrimoineAssets: PatrimoineAsset[];
}

export interface MonthlyTotal {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

export interface CategoryTotal {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
}

export interface BudgetProgress {
  budget: Budget;
  category: Category;
  actual: number;
  percentage: number;
  remaining: number;
}

export interface CashOccurrence {
  expense: Expense;
  date: Date;
  month: string;
}

// Résultat de recherche ticker
export interface TickerResult {
  symbol: string;
  name: string;
  type: string;         // 'EQUITY', 'ETF', 'CURRENCY', etc.
  exchange?: string;
  currentPrice?: number;
  dividendRate?: number;  // annuel par action
  dividendYield?: number; // %
}
