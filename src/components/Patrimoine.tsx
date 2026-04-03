import React, { useState, useMemo, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  Banknote,
  Building,
  Bitcoin,
  BarChart2,
  Landmark,
  Briefcase,
  Printer,
  Wallet,
  Percent,
  DollarSign,
  Search,
  BookOpen,
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../calculations';
import type {
  PatrimoineAsset,
  PatrimoineHolding,
  PatrimoineType,
  BankAccount,
  DividendInfo,
  DividendFrequency,
  TickerResult,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import TickerSearch, { fetchYahooQuote, fetchCryptoPrice } from './TickerSearch';

// Default tax rates per type
const DEFAULT_TAX: Record<PatrimoineType, number> = {
  PEA: 0.172,    // 17,2% prélèvements sociaux seulement après 5 ans (gains exonérés IR)
  CTO: 0.314,    // 30% IR + 1,4% PS = 31,4% PFU
  crypto: 0.30,  // 30% flat tax crypto
  crowdfunding: 0.30,
  immobilier: 0,
  autre: 0,
};

const APPLY_TAX_DEFAULT: Record<PatrimoineType, boolean> = {
  PEA: false,    // PEA exonéré après 5 ans (souvent)
  CTO: true,
  crypto: true,
  crowdfunding: false,
  immobilier: false,
  autre: false,
};

const TYPE_CONFIG: Record<PatrimoineType, { label: string; gradient: string; icon: React.ReactNode; description: string }> = {
  PEA: { label: 'PEA', gradient: 'from-indigo-500 to-indigo-600', icon: <Landmark className="w-5 h-5" />, description: 'Plan d\'Épargne en Actions' },
  CTO: { label: 'CTO', gradient: 'from-violet-500 to-violet-600', icon: <BarChart2 className="w-5 h-5" />, description: 'Compte-Titres Ordinaire' },
  crypto: { label: 'Crypto', gradient: 'from-amber-500 to-orange-500', icon: <Bitcoin className="w-5 h-5" />, description: 'Cryptomonnaies' },
  crowdfunding: { label: 'Crowdfunding', gradient: 'from-emerald-500 to-teal-500', icon: <Briefcase className="w-5 h-5" />, description: 'Financement participatif' },
  immobilier: { label: 'Immobilier', gradient: 'from-blue-500 to-blue-600', icon: <Building className="w-5 h-5" />, description: 'Biens immobiliers' },
  autre: { label: 'Autre', gradient: 'from-slate-500 to-slate-600', icon: <Banknote className="w-5 h-5" />, description: 'Autres actifs' },
};

const ASSET_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#64748b', '#f97316'];

const DIV_FREQ_LABELS: Record<DividendFrequency, string> = {
  monthly: 'Mensuel', quarterly: 'Trimestriel', 'semi-annual': 'Semestriel', annual: 'Annuel',
};

type AssetTab = 'all' | PatrimoineType | 'livrets';

function emptyHolding(): PatrimoineHolding {
  return { id: uuidv4(), ticker: '', name: '', quantity: 0, purchasePrice: 0, currentPrice: 0, currency: 'EUR' };
}

function emptyAssetForm() {
  return {
    type: 'PEA' as PatrimoineType,
    name: '',
    color: '#6366f1',
    notes: '',
    manualValue: 0,
    manualInvested: 0,
    useManualValue: false,
    applyTax: false as boolean,
    taxRate: 0.314,
  };
}

function calcHoldingDividend(h: PatrimoineHolding): number {
  const d = h.dividend;
  if (!d) return 0;
  if (d.totalAnnual) return d.totalAnnual;
  if (d.amountPerShare) return h.quantity * d.amountPerShare;
  if (d.yieldPct) return h.quantity * h.currentPrice * d.yieldPct / 100;
  return 0;
}

function assetMetrics(asset: PatrimoineAsset) {
  const useManual = asset.manualValue !== undefined && asset.holdings.length === 0;
  if (useManual) {
    const currentValue = asset.manualValue!;
    const invested = asset.manualInvested ?? 0;
    const gain = currentValue - invested;
    const perf = invested > 0 ? (gain / invested) * 100 : 0;
    return { currentValue, invested, gain, perf, annualDividends: 0 };
  }
  const currentValue = asset.holdings.reduce((s, h) => s + h.quantity * h.currentPrice, 0);
  const invested = asset.holdings.reduce((s, h) => s + h.quantity * h.purchasePrice, 0);
  const gain = currentValue - invested;
  const perf = invested > 0 ? (gain / invested) * 100 : 0;
  const annualDividends = asset.holdings.reduce((s, h) => s + calcHoldingDividend(h), 0);
  return { currentValue, invested, gain, perf, annualDividends };
}

function taxImpact(asset: PatrimoineAsset, gain: number, dividends: number) {
  if (!asset.applyTax || !asset.taxRate) return { taxOnGain: 0, taxOnDiv: 0, netGain: gain, netDividends: dividends };
  const r = asset.taxRate;
  const taxOnGain = gain > 0 ? gain * r : 0;
  const taxOnDiv = dividends * r;
  return { taxOnGain, taxOnDiv, netGain: gain - taxOnGain, netDividends: dividends - taxOnDiv };
}

export default function Patrimoine() {
  const { patrimoineAssets, addPatrimoineAsset, updatePatrimoineAsset, deletePatrimoineAsset, bankAccounts } = useData();
  const { currentUser } = useAuth();
  const currency = currentUser?.settings?.currency ?? 'EUR';
  const fmt = (n: number) => formatCurrency(n, currency);

  const [activeTab, setActiveTab] = useState<AssetTab>('all');
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<PatrimoineAsset | null>(null);
  const [assetForm, setAssetForm] = useState(emptyAssetForm());
  const [holdings, setHoldings] = useState<PatrimoineHolding[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [showAfterTax, setShowAfterTax] = useState(false);
  const [editingDividend, setEditingDividend] = useState<{ assetId: string; holdingId: string } | null>(null);
  const [divForm, setDivForm] = useState<DividendInfo>({ mode: 'manual' });
  const [isinSearching, setIsinSearching] = useState<string | null>(null);

  // Livret accounts that count as patrimoine
  const livretAccounts = useMemo(
    () => (bankAccounts ?? []).filter(a => a.includeInPatrimoine),
    [bankAccounts]
  );

  const totalLivrets = useMemo(
    () => livretAccounts.reduce((s, a) => s + a.balance, 0),
    [livretAccounts]
  );

  // Global metrics
  const globalMetrics = useMemo(() => {
    let totalValue = 0, totalInvested = 0, totalDividends = 0;
    for (const asset of patrimoineAssets) {
      const m = assetMetrics(asset);
      totalValue += m.currentValue;
      totalInvested += m.invested;
      totalDividends += m.annualDividends;
    }
    totalValue += totalLivrets;
    totalInvested += totalLivrets;
    const totalGain = totalValue - totalInvested;
    const totalPerf = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
    return { totalValue, totalInvested, totalGain, totalPerf, totalDividends };
  }, [patrimoineAssets, totalLivrets]);

  const filteredAssets = useMemo(() => {
    if (activeTab === 'all') return patrimoineAssets;
    if (activeTab === 'livrets') return [];
    return patrimoineAssets.filter(a => a.type === activeTab);
  }, [patrimoineAssets, activeTab]);

  const toggleExpand = (id: string) => {
    setExpandedAssets(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openAddAsset = () => {
    setEditingAsset(null);
    const defaultType: PatrimoineType = 'PEA';
    setAssetForm({ ...emptyAssetForm(), applyTax: APPLY_TAX_DEFAULT[defaultType], taxRate: DEFAULT_TAX[defaultType] });
    setHoldings([emptyHolding()]);
    setShowAssetModal(true);
  };

  const openEditAsset = (asset: PatrimoineAsset) => {
    setEditingAsset(asset);
    setAssetForm({
      type: asset.type,
      name: asset.name,
      color: asset.color,
      notes: asset.notes ?? '',
      manualValue: asset.manualValue ?? 0,
      manualInvested: asset.manualInvested ?? 0,
      useManualValue: asset.manualValue !== undefined && asset.holdings.length === 0,
      applyTax: asset.applyTax ?? APPLY_TAX_DEFAULT[asset.type],
      taxRate: asset.taxRate ?? DEFAULT_TAX[asset.type],
    });
    setHoldings(asset.holdings.length > 0 ? [...asset.holdings.map(h => ({ ...h }))] : [emptyHolding()]);
    setShowAssetModal(true);
  };

  const handleTypeChange = (type: PatrimoineType) => {
    setAssetForm(f => ({
      ...f,
      type,
      applyTax: APPLY_TAX_DEFAULT[type],
      taxRate: DEFAULT_TAX[type],
    }));
  };

  const handleSaveAsset = () => {
    if (!assetForm.name.trim()) return;
    const finalHoldings = assetForm.useManualValue
      ? []
      : holdings
          .filter(h => h.name.trim() || h.ticker.trim())
          .map(h => ({
            ...h,
            // If PRU not set, default to current price (break-even at entry)
            purchasePrice: h.purchasePrice > 0 ? h.purchasePrice : h.currentPrice,
          }));
    const payload: Partial<PatrimoineAsset> = {
      type: assetForm.type,
      name: assetForm.name,
      color: assetForm.color,
      notes: assetForm.notes,
      holdings: finalHoldings,
      manualValue: assetForm.useManualValue ? assetForm.manualValue : undefined,
      manualInvested: assetForm.useManualValue ? assetForm.manualInvested : undefined,
      applyTax: assetForm.applyTax,
      taxRate: assetForm.taxRate,
    };
    if (editingAsset) updatePatrimoineAsset(editingAsset.id, payload);
    else addPatrimoineAsset(payload as Omit<PatrimoineAsset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>);
    setShowAssetModal(false);
  };

  const addHoldingRow = () => setHoldings(h => [...h, emptyHolding()]);
  const removeHoldingRow = (id: string) => setHoldings(h => h.filter(x => x.id !== id));
  const updateHolding = (id: string, updates: Partial<PatrimoineHolding>) => {
    setHoldings(h => h.map(x => x.id === id ? { ...x, ...updates } : x));
  };

  // Handle ticker search result → populate holding
  const handleTickerSelect = (holdingId: string, result: TickerResult) => {
    const updates: Partial<PatrimoineHolding> = {
      ticker: result.symbol,
      name: result.name,
      currentPrice: result.currentPrice ?? 0,
    };
    if (result.dividendRate || result.dividendYield) {
      updates.dividend = {
        mode: 'auto',
        amountPerShare: result.dividendRate,
        yieldPct: result.dividendYield,
        lastFetched: new Date().toISOString(),
      };
    }
    updateHolding(holdingId, updates);
  };

  // Search by ISIN and auto-populate holding fields
  const handleIsinChange = async (holdingId: string, isin: string) => {
    updateHolding(holdingId, { isin });
    const cleaned = isin.trim().toUpperCase();
    if (cleaned.length !== 12) return;
    setIsinSearching(holdingId);
    try {
      const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(cleaned)}&quotesCount=5&newsCount=0&listsCount=0`;
      const searchRes = await fetch(searchUrl);
      if (!searchRes.ok) return;
      const searchData = await searchRes.json();
      const quotes = (searchData?.quotes ?? []) as any[];
      const q = quotes.find(x => x.quoteType === 'EQUITY' || x.quoteType === 'ETF' || x.quoteType === 'MUTUALFUND');
      if (!q) return;
      const { price, dividendRate, dividendYield } = await fetchYahooQuote(q.symbol);
      const updates: Partial<import('../types').PatrimoineHolding> = {
        ticker: q.symbol,
        name: q.longname || q.shortname || q.symbol,
        currentPrice: price,
        isin: cleaned,
      };
      if (dividendRate || dividendYield) {
        updates.dividend = { mode: 'auto', amountPerShare: dividendRate, yieldPct: dividendYield, lastFetched: new Date().toISOString() };
      }
      updateHolding(holdingId, updates);
    } catch { /* silent */ } finally {
      setIsinSearching(null);
    }
  };

  // Fetch real-time prices for all holdings of an asset (with EUR conversion)
  const fetchPrices = useCallback(async (asset: PatrimoineAsset) => {
    setFetchingId(asset.id);
    const updated = await Promise.all(
      asset.holdings.map(async h => {
        try {
          if (asset.type === 'crypto') {
            const { price } = await fetchCryptoPrice(h.ticker);
            return { ...h, currentPrice: price, lastUpdated: new Date().toISOString() };
          } else {
            const { price, dividendRate, dividendYield } = await fetchYahooQuote(h.ticker);
            let dividend = h.dividend;
            if (h.dividend?.mode === 'auto') {
              dividend = { ...h.dividend, amountPerShare: dividendRate, yieldPct: dividendYield, lastFetched: new Date().toISOString() };
            }
            return { ...h, currentPrice: price, dividend, lastUpdated: new Date().toISOString() };
          }
        } catch { return h; }
      })
    );
    updatePatrimoineAsset(asset.id, { holdings: updated });
    setFetchingId(null);
  }, [updatePatrimoineAsset]);

  // Open dividend editor
  const openDividendEditor = (assetId: string, h: PatrimoineHolding) => {
    setEditingDividend({ assetId, holdingId: h.id });
    setDivForm(h.dividend ?? { mode: 'manual' });
  };

  const saveDividend = () => {
    if (!editingDividend) return;
    const asset = patrimoineAssets.find(a => a.id === editingDividend.assetId);
    if (!asset) return;
    const updated = asset.holdings.map(h =>
      h.id === editingDividend.holdingId ? { ...h, dividend: divForm } : h
    );
    updatePatrimoineAsset(editingDividend.assetId, { holdings: updated });
    setEditingDividend(null);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Print header */}
      <div className="hidden print:flex items-center gap-3 mb-6 pb-4 border-b-2 border-indigo-500">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
          <span className="text-white font-black text-lg">F</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Finance Manager — Patrimoine</h1>
          <p className="text-sm text-gray-500">Généré le {format(new Date(), 'd MMMM yyyy', { locale: fr })}</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Patrimoine</h1>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="no-print flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all">
            <Printer className="w-4 h-4" />
          </button>
          <button onClick={openAddAsset} className="no-print flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Ajouter un actif
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-5 text-white shadow-lg col-span-2 lg:col-span-1">
          <p className="text-indigo-100 text-xs mb-1">Valeur totale</p>
          <p className="text-2xl font-bold">{fmt(globalMetrics.totalValue)}</p>
          <p className="text-indigo-200 text-xs mt-1">{patrimoineAssets.length} actif{patrimoineAssets.length > 1 ? 's' : ''}{livretAccounts.length > 0 ? ` + ${livretAccounts.length} livret${livretAccounts.length > 1 ? 's' : ''}` : ''}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Investi</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(globalMetrics.totalInvested)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Gain / Perte</p>
          <p className={`text-xl font-bold ${globalMetrics.totalGain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {globalMetrics.totalGain >= 0 ? '+' : ''}{fmt(globalMetrics.totalGain)}
          </p>
          <p className={`text-xs ${globalMetrics.totalPerf >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {globalMetrics.totalPerf >= 0 ? '+' : ''}{globalMetrics.totalPerf.toFixed(2)}%
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Dividendes / an</p>
          <p className="text-xl font-bold text-amber-500">{fmt(globalMetrics.totalDividends)}</p>
          {globalMetrics.totalDividends > 0 && (
            <p className="text-xs text-gray-400">{fmt(globalMetrics.totalDividends / 12)}/mois</p>
          )}
        </div>
      </div>

      {/* After-tax toggle */}
      <label className="flex items-center gap-2 cursor-pointer w-fit">
        <div onClick={() => setShowAfterTax(!showAfterTax)} className={`relative w-11 h-6 rounded-full transition-colors ${showAfterTax ? 'bg-violet-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${showAfterTax ? 'translate-x-5' : ''}`} />
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">Afficher les montants après fiscalité (par actif)</span>
      </label>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl w-fit flex-wrap">
        {([
          { id: 'all', label: 'Tous' },
          ...Object.entries(TYPE_CONFIG).map(([k, v]) => ({ id: k as AssetTab, label: v.label })),
          ...(livretAccounts.length > 0 ? [{ id: 'livrets' as AssetTab, label: 'Livrets' }] : []),
        ]).map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as AssetTab)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Livrets section */}
      {(activeTab === 'all' || activeTab === 'livrets') && livretAccounts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-500" />
              <span className="font-semibold text-gray-900 dark:text-white">Livrets & épargne réglementée</span>
            </div>
            <span className="font-bold text-teal-600 dark:text-teal-400">{fmt(totalLivrets)}</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {livretAccounts.map(acc => (
              <div key={acc.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: acc.color }}>
                    {acc.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{acc.name}</p>
                    {acc.interestRate && (
                      <p className="text-xs text-teal-500">{acc.interestRate}% / an</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900 dark:text-white">{fmt(acc.balance)}</p>
                  {acc.interestRate && (
                    <p className="text-xs text-teal-500">+{fmt(acc.balance * acc.interestRate / 100)}/an</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assets list */}
      {filteredAssets.length === 0 && activeTab !== 'livrets' ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-16 text-center border border-gray-200 dark:border-slate-700">
          <TrendingUp className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">Aucun actif patrimonial</p>
          <p className="text-sm text-gray-400">Ajoutez vos investissements (PEA, CTO, Crypto, Immobilier…)</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAssets.map(asset => {
            const cfg = TYPE_CONFIG[asset.type];
            const m = assetMetrics(asset);
            const tax = taxImpact(asset, m.gain, m.annualDividends);
            const isExpanded = expandedAssets.has(asset.id);
            const displayGain = showAfterTax && asset.applyTax ? tax.netGain : m.gain;
            const displayValue = showAfterTax && asset.applyTax ? m.currentValue - tax.taxOnGain : m.currentValue;
            const displayDividends = showAfterTax && asset.applyTax ? tax.netDividends : m.annualDividends;

            return (
              <div key={asset.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors" onClick={() => toggleExpand(asset.id)}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm bg-gradient-to-br ${cfg.gradient}`}>
                      {cfg.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{asset.name}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400">
                          {cfg.label}
                        </span>
                        {asset.applyTax && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                            Fiscalité {(asset.taxRate! * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{asset.holdings.length > 0 ? `${asset.holdings.length} ligne${asset.holdings.length > 1 ? 's' : ''}` : 'Valeur manuelle'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-5 text-right">
                      <div>
                        <p className="text-xs text-gray-400">Valeur</p>
                        <p className="font-bold text-gray-900 dark:text-white">{fmt(displayValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Perf.</p>
                        <p className={`font-semibold text-sm ${m.perf >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {m.perf >= 0 ? '+' : ''}{m.perf.toFixed(1)}%
                        </p>
                      </div>
                      {m.annualDividends > 0 && (
                        <div>
                          <p className="text-xs text-gray-400">Div./an</p>
                          <p className="font-semibold text-sm text-amber-500">{fmt(displayDividends)}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 no-print" onClick={e => e.stopPropagation()}>
                      {(asset.type === 'PEA' || asset.type === 'CTO' || asset.type === 'crypto') && asset.holdings.length > 0 && (
                        <button onClick={() => fetchPrices(asset)} disabled={fetchingId === asset.id} className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors" title="Actualiser">
                          <RefreshCw className={`w-4 h-4 ${fetchingId === asset.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      <button onClick={() => openEditAsset(asset)} className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"><Pencil className="w-4 h-4" /></button>
                      {deleteConfirm === asset.id ? (
                        <>
                          <button onClick={() => { deletePatrimoineAsset(asset.id); setDeleteConfirm(null); }} className="p-1.5 text-red-500"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-gray-400"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <button onClick={() => setDeleteConfirm(asset.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </div>

                {/* Expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700">
                    {/* Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-slate-700/30">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Valeur actuelle</p>
                        <p className="font-bold text-gray-900 dark:text-white">{fmt(m.currentValue)}</p>
                        {showAfterTax && asset.applyTax && tax.taxOnGain > 0 && (
                          <p className="text-xs text-violet-500">Après fisc.: {fmt(displayValue)}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Investi</p>
                        <p className="font-bold text-gray-900 dark:text-white">{fmt(m.invested)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Gain / Perte</p>
                        <p className={`font-bold ${m.gain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{m.gain >= 0 ? '+' : ''}{fmt(m.gain)}</p>
                        <p className={`text-xs ${m.perf >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{m.perf >= 0 ? '+' : ''}{m.perf.toFixed(2)}%</p>
                        {showAfterTax && asset.applyTax && tax.taxOnGain > 0 && (
                          <p className="text-xs text-violet-500">Impôt: -{fmt(tax.taxOnGain)}</p>
                        )}
                      </div>
                      {m.annualDividends > 0 && (
                        <div>
                          <p className="text-xs text-gray-400 mb-0.5">Dividendes / an</p>
                          <p className="font-bold text-amber-500">{fmt(m.annualDividends)}</p>
                          {showAfterTax && asset.applyTax && (
                            <p className="text-xs text-violet-500">Nets: {fmt(tax.netDividends)}</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Holdings table */}
                    {asset.holdings.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/20">
                              <th className="text-left px-4 py-2 text-xs font-medium text-gray-400">Titre</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-gray-400">Qté</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-gray-400">PRU</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-gray-400">Cours</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-gray-400">Valeur</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-gray-400">+/-</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-gray-400">Perf.</th>
                              <th className="text-right px-3 py-2 text-xs font-medium text-gray-400">Dividendes</th>
                              <th className="px-3 py-2 text-xs font-medium text-gray-400 no-print"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {asset.holdings.map(h => {
                              const val = h.quantity * h.currentPrice;
                              const inv = h.quantity * h.purchasePrice;
                              const gain = val - inv;
                              const perf = inv > 0 ? (gain / inv) * 100 : 0;
                              const annDiv = calcHoldingDividend(h);
                              const d = h.dividend;
                              return (
                                <tr key={h.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                                  <td className="px-4 py-2.5">
                                    <p className="font-semibold text-gray-900 dark:text-white">{h.ticker}</p>
                                    <p className="text-xs text-gray-400 truncate max-w-[140px]">{h.name}</p>
                                    {h.lastUpdated && <p className="text-xs text-gray-300 dark:text-gray-600">{format(new Date(h.lastUpdated), 'dd/MM HH:mm')}</p>}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                                    {h.quantity % 1 === 0 ? h.quantity : h.quantity.toFixed(6)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right text-gray-500 tabular-nums">{fmt(h.purchasePrice)}</td>
                                  <td className="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-white tabular-nums">{fmt(h.currentPrice)}</td>
                                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-white tabular-nums">{fmt(val)}</td>
                                  <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${gain >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {gain >= 0 ? '+' : ''}{fmt(gain)}
                                  </td>
                                  <td className={`px-3 py-2.5 text-right text-xs font-semibold tabular-nums ${perf >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {perf >= 0 ? '+' : ''}{perf.toFixed(2)}%
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    {annDiv > 0 ? (
                                      <div>
                                        <p className="text-xs font-semibold text-amber-500">{fmt(annDiv)}/an</p>
                                        {d?.amountPerShare && <p className="text-xs text-gray-400">{fmt(d.amountPerShare)}/titre</p>}
                                        {d?.frequency && <p className="text-xs text-gray-300 dark:text-gray-600">{DIV_FREQ_LABELS[d.frequency]}</p>}
                                        {d?.mode === 'auto' && d.lastFetched && (
                                          <p className="text-xs text-indigo-400">Auto</p>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 no-print">
                                    <button onClick={() => openDividendEditor(asset.id, h)} className="p-1 text-gray-300 dark:text-gray-600 hover:text-amber-500 transition-colors" title="Modifier dividendes">
                                      <DollarSign className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {asset.notes && (
                      <div className="px-4 py-3 bg-gray-50 dark:bg-slate-700/30 border-t border-gray-100 dark:border-slate-700">
                        <p className="text-xs text-gray-400 mb-1">Notes</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{asset.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ ASSET MODAL ═══ */}
      {showAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-700 shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingAsset ? 'Modifier l\'actif' : 'Nouvel actif patrimonial'}
              </h3>
              <button onClick={() => setShowAssetModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5 flex-1">
              {/* Type & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type d'actif</label>
                  <select value={assetForm.type} onChange={e => handleTypeChange(e.target.value as PatrimoineType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.label} — {v.description}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom du compte</label>
                  <input type="text" value={assetForm.name} onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={`Ex: PEA Boursorama, Binance…`}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Couleur</label>
                <div className="flex gap-2 flex-wrap">
                  {ASSET_COLORS.map(c => (
                    <button key={c} onClick={() => setAssetForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-lg transition-all ${assetForm.color === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              {/* Fiscalité configurable */}
              <div className="p-4 bg-violet-50 dark:bg-violet-900/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div onClick={() => setAssetForm(f => ({ ...f, applyTax: !f.applyTax }))}
                      className={`relative w-10 h-5 rounded-full transition-colors ${assetForm.applyTax ? 'bg-violet-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${assetForm.applyTax ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Appliquer une fiscalité</span>
                  </label>
                  <span className="text-xs text-violet-500">
                    {assetForm.type === 'PEA' ? 'PEA exonéré après 5 ans' : assetForm.type === 'CTO' ? 'PFU 31,4% recommandé' : assetForm.type === 'crypto' ? 'Flat tax crypto 30%' : ''}
                  </span>
                </div>
                {assetForm.applyTax && (
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-gray-600 dark:text-gray-400">Taux (%)</label>
                    <input type="number" value={(assetForm.taxRate * 100).toFixed(1)}
                      onChange={e => setAssetForm(f => ({ ...f, taxRate: parseFloat(e.target.value) / 100 || 0 }))}
                      step="0.1" min="0" max="100"
                      className="w-24 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    <span className="text-sm text-gray-500">%</span>
                    <div className="flex gap-1">
                      {[17.2, 30, 31.4].map(r => (
                        <button key={r} onClick={() => setAssetForm(f => ({ ...f, taxRate: r / 100 }))}
                          className="text-xs px-2 py-1 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-600 hover:bg-violet-200">
                          {r}%
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual vs holdings toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={assetForm.useManualValue}
                  onChange={e => setAssetForm(f => ({ ...f, useManualValue: e.target.checked }))}
                  className="w-4 h-4 rounded text-indigo-500" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Valeur globale manuelle (sans détail des lignes)</span>
              </label>

              {assetForm.useManualValue ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valeur actuelle</label>
                    <input type="number" value={assetForm.manualValue}
                      onChange={e => setAssetForm(f => ({ ...f, manualValue: parseFloat(e.target.value) || 0 }))}
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Montant investi</label>
                    <input type="number" value={assetForm.manualInvested}
                      onChange={e => setAssetForm(f => ({ ...f, manualInvested: parseFloat(e.target.value) || 0 }))}
                      step="0.01"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Lignes / Positions</label>
                    <button onClick={addHoldingRow} className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Ajouter une ligne
                    </button>
                  </div>
                  <div className="space-y-4">
                    {holdings.map((h, idx) => (
                      <div key={h.id} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-500">Ligne {idx + 1}</span>
                          {holdings.length > 1 && (
                            <button onClick={() => removeHoldingRow(h.id)} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                          )}
                        </div>

                        {/* Smart search */}
                        {(assetForm.type === 'PEA' || assetForm.type === 'CTO' || assetForm.type === 'crypto') && (
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Recherche intelligente</label>
                            <TickerSearch
                              assetType={assetForm.type}
                              onSelect={result => handleTickerSelect(h.id, result)}
                              placeholder={assetForm.type === 'crypto' ? 'Rechercher (Bitcoin, Ethereum…)' : 'Rechercher (Apple, LVMH, CAC40…)'}
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Ticker / Symbole</label>
                            <input type="text" value={h.ticker}
                              onChange={e => updateHolding(h.id, { ticker: e.target.value })}
                              placeholder="AAPL, BTC…"
                              className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs text-gray-400 mb-0.5">Nom</label>
                            <input type="text" value={h.name}
                              onChange={e => updateHolding(h.id, { name: e.target.value })}
                              placeholder="Apple Inc., Bitcoin…"
                              className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Quantité</label>
                            <input type="number" value={h.quantity}
                              onChange={e => updateHolding(h.id, { quantity: parseFloat(e.target.value) || 0 })}
                              step="0.000001" min="0"
                              className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-0.5">PRU (€) <span className="text-gray-300">optionnel</span></label>
                            <input type="number" value={h.purchasePrice || ''}
                              onChange={e => updateHolding(h.id, { purchasePrice: parseFloat(e.target.value) || 0 })}
                              step="0.0001" min="0"
                              placeholder="= cours actuel"
                              className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-0.5">Cours (€)</label>
                            <input type="number" value={h.currentPrice || ''}
                              onChange={e => updateHolding(h.id, { currentPrice: parseFloat(e.target.value) || 0 })}
                              step="0.0001" min="0"
                              className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-0.5 flex items-center gap-1">
                              ISIN
                              {isinSearching === h.id && <span className="text-indigo-400">⏳</span>}
                            </label>
                            <input type="text" value={h.isin ?? ''}
                              onChange={e => handleIsinChange(h.id, e.target.value)}
                              placeholder="FR0000131104"
                              maxLength={12}
                              className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase" />
                          </div>
                        </div>

                        {/* Live preview */}
                        {h.quantity > 0 && h.currentPrice > 0 && (
                          <div className="flex items-center gap-4 text-xs text-gray-500 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg">
                            <span>Valeur: <strong className="text-gray-900 dark:text-white">{fmt(h.quantity * h.currentPrice)}</strong></span>
                            {h.purchasePrice > 0 && (
                              <span className={h.currentPrice >= h.purchasePrice ? 'text-emerald-500' : 'text-red-500'}>
                                {((h.currentPrice - h.purchasePrice) / h.purchasePrice * 100).toFixed(2)}%
                              </span>
                            )}
                            {h.dividend && calcHoldingDividend(h) > 0 && (
                              <span className="text-amber-500">Div: {fmt(calcHoldingDividend(h))}/an</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                <textarea value={assetForm.notes} onChange={e => setAssetForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Notes optionnelles…"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-slate-700 shrink-0">
              <button onClick={() => setShowAssetModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-all">Annuler</button>
              <button onClick={handleSaveAsset} disabled={!assetForm.name.trim()}
                className="px-4 py-2 text-sm bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg transition-all font-medium">
                {editingAsset ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DIVIDEND EDITOR MODAL ═══ */}
      {editingDividend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dividendes</h3>
              <button onClick={() => setEditingDividend(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Mode */}
              <div className="flex gap-2">
                {(['auto', 'manual'] as const).map(m => (
                  <button key={m} onClick={() => setDivForm(f => ({ ...f, mode: m }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${divForm.mode === m ? 'bg-amber-500 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'}`}>
                    {m === 'auto' ? '🔄 Auto (Yahoo Finance)' : '✏️ Manuel'}
                  </button>
                ))}
              </div>

              {divForm.mode === 'auto' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                  <p className="text-xs text-amber-600 dark:text-amber-400">En mode Auto, les dividendes sont récupérés automatiquement depuis Yahoo Finance lors de l'actualisation des cours.</p>
                </div>
              )}

              {/* Montant par action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dividende par titre (€/an)</label>
                <input type="number" value={divForm.amountPerShare ?? ''} placeholder="Ex: 1.50"
                  onChange={e => setDivForm(f => ({ ...f, amountPerShare: parseFloat(e.target.value) || undefined }))}
                  step="0.0001"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                <p className="text-xs text-gray-400 mt-1">Montant nominal annuel brut par action</p>
              </div>

              {/* Rendement % (optionnel) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rendement % (fallback)</label>
                <input type="number" value={divForm.yieldPct ?? ''} placeholder="Ex: 3.5"
                  onChange={e => setDivForm(f => ({ ...f, yieldPct: parseFloat(e.target.value) || undefined }))}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>

              {/* Total annuel direct */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total annuel brut (€)</label>
                <input type="number" value={divForm.totalAnnual ?? ''} placeholder="Priorité sur les autres champs"
                  onChange={e => setDivForm(f => ({ ...f, totalAnnual: parseFloat(e.target.value) || undefined }))}
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
              </div>

              {/* Fréquence */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fréquence de versement</label>
                <select value={divForm.frequency ?? ''} onChange={e => setDivForm(f => ({ ...f, frequency: e.target.value as DividendFrequency || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="">Non spécifié</option>
                  <option value="monthly">Mensuel</option>
                  <option value="quarterly">Trimestriel</option>
                  <option value="semi-annual">Semestriel</option>
                  <option value="annual">Annuel</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-slate-700">
              <button onClick={() => setEditingDividend(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annuler</button>
              <button onClick={saveDividend} className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
