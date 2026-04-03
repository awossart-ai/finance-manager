import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ThemeMode } from '../types';
import { getSunTimes } from '../suntime';
import { useAuth } from './AuthContext';

interface ThemeContextValue {
  currentTheme: 'dark' | 'light';
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveAutoTheme(lat: number, lon: number): 'dark' | 'light' {
  const now = new Date();
  try {
    const { sunrise, sunset } = getSunTimes(lat, lon, now);
    return now >= sunrise && now < sunset ? 'light' : 'dark';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, updateUser } = useAuth();
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light');

  const themeMode: ThemeMode = currentUser?.settings?.theme ?? 'auto';

  const applyTheme = useCallback(
    (mode: ThemeMode) => {
      if (mode === 'dark') {
        document.documentElement.classList.add('dark');
        setResolvedTheme('dark');
      } else if (mode === 'light') {
        document.documentElement.classList.remove('dark');
        setResolvedTheme('light');
      } else {
        // auto
        const location = currentUser?.settings?.location;
        const lat = location?.lat ?? 48.8566;
        const lon = location?.lon ?? 2.3522;
        const theme = resolveAutoTheme(lat, lon);
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        setResolvedTheme(theme);
      }
    },
    [currentUser?.settings?.location]
  );

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode, applyTheme]);

  // Update every minute for auto mode
  useEffect(() => {
    if (themeMode !== 'auto') return;
    const interval = setInterval(() => applyTheme('auto'), 60000);
    return () => clearInterval(interval);
  }, [themeMode, applyTheme]);

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      updateUser({ settings: { ...currentUser?.settings, theme: mode, currency: currentUser?.settings?.currency ?? 'EUR' } });
    },
    [updateUser, currentUser?.settings]
  );

  return (
    <ThemeContext.Provider
      value={{ currentTheme: resolvedTheme, themeMode, setThemeMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
