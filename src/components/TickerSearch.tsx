import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, TrendingUp, Bitcoin } from 'lucide-react';
import type { PatrimoineType, TickerResult } from '../types';

interface TickerSearchProps {
  assetType: PatrimoineType;
  onSelect: (result: TickerResult) => void;
  placeholder?: string;
}

// --- FX helpers ---
async function fetchFxRate(symbol: string): Promise<number> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const res = await fetch(url);
    if (!res.ok) return 1;
    const data = await res.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? 1;
  } catch { return 1; }
}

// Returns the multiplier to convert 1 unit of `currency` into EUR.
// GBp / GBX = British pence (1/100 GBP).
async function getEurMultiplier(currency: string): Promise<number> {
  if (!currency || currency === 'EUR') return 1;
  const isGBX = currency === 'GBp' || currency === 'GBX';
  const baseCurrency = isGBX ? 'GBP' : currency;
  const rate = await fetchFxRate(`${baseCurrency}EUR=X`);
  return isGBX ? rate / 100 : rate;
}

// Yahoo Finance search
async function searchYahoo(query: string): Promise<TickerResult[]> {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0&listsCount=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Yahoo search failed');
  const data = await res.json();
  const quotes = data?.quotes ?? [];
  return quotes
    .filter((q: any) => q.symbol && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND'))
    .map((q: any): TickerResult => ({
      symbol: q.symbol,
      name: q.longname || q.shortname || q.symbol,
      type: q.quoteType ?? 'EQUITY',
      exchange: q.exchDisp ?? q.exchange,
    }));
}

// Fetch quote details — price and dividends converted to EUR.
export async function fetchYahooQuote(symbol: string): Promise<{ price: number; dividendRate?: number; dividendYield?: number }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Quote failed');
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error('No meta');
  const nativePrice = meta.regularMarketPrice ?? meta.chartPreviousClose ?? 0;
  const currency = meta.currency ?? 'EUR';
  const multiplier = await getEurMultiplier(currency);
  return {
    price: nativePrice * multiplier,
    dividendRate: meta.trailingAnnualDividendRate != null
      ? meta.trailingAnnualDividendRate * multiplier
      : undefined,
    dividendYield: meta.trailingAnnualDividendYield
      ? meta.trailingAnnualDividendYield * 100
      : undefined,
  };
}

// CoinGecko search
async function searchCoinGecko(query: string): Promise<TickerResult[]> {
  const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('CoinGecko search failed');
  const data = await res.json();
  const coins = data?.coins ?? [];
  return coins.slice(0, 8).map((c: any): TickerResult => ({
    symbol: c.id,
    name: c.name,
    type: 'CRYPTO',
    exchange: c.symbol?.toUpperCase(),
  }));
}

export async function fetchCryptoPrice(id: string): Promise<{ price: number }> {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=eur`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('CoinGecko price failed');
  const data = await res.json();
  const price = data[id]?.eur;
  if (!price) throw new Error('No price');
  return { price };
}

export default function TickerSearch({ assetType, onSelect, placeholder }: TickerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TickerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isCrypto = assetType === 'crypto';

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    setError('');
    try {
      const res = isCrypto ? await searchCoinGecko(q) : await searchYahoo(q);
      setResults(res);
      setOpen(res.length > 0);
    } catch {
      setError('Recherche indisponible — saisie manuelle possible');
      setResults([]);
    }
    setLoading(false);
  }, [isCrypto]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 320);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = async (result: TickerResult) => {
    setOpen(false);
    setQuery(result.name);
    setLoadingPrice(result.symbol);
    try {
      if (isCrypto) {
        const { price } = await fetchCryptoPrice(result.symbol);
        onSelect({ ...result, currentPrice: price });
      } else {
        const { price, dividendRate, dividendYield } = await fetchYahooQuote(result.symbol);
        onSelect({ ...result, currentPrice: price, dividendRate, dividendYield });
      }
    } catch {
      onSelect(result); // sans prix
    }
    setLoadingPrice(null);
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'EQUITY': return 'Action';
      case 'ETF': return 'ETF';
      case 'MUTUALFUND': return 'OPCVM';
      case 'CRYPTO': return 'Crypto';
      default: return type;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        {loading || loadingPrice ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
        ) : isCrypto ? (
          <Bitcoin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? (isCrypto ? 'Rechercher une crypto (Bitcoin, Ethereum…)' : 'Rechercher un titre (Apple, AAPL, CAC40…)')}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && (
        <p className="text-xs text-amber-500 mt-1 px-1">{error}</p>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => handleSelect(r)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{r.symbol}</p>
                  <p className="text-xs text-gray-400 truncate">{r.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400">
                  {typeLabel(r.type)}
                </span>
                {r.exchange && (
                  <span className="text-xs text-gray-400">{r.exchange}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
