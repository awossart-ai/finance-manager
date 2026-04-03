import React, { useState } from 'react';
import {
  User,
  Lock,
  Palette,
  MapPin,
  DollarSign,
  Database,
  Trash2,
  Download,
  Upload,
  Sun,
  Moon,
  Laptop,
  AlertCircle,
  CheckCircle,
  Navigation,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { getSunTimes } from '../suntime';
import { getUserData } from '../storage';
import Modal from './Modal';
import type { CurrencyCode, ThemeMode } from '../types';

const CURRENCIES: { code: CurrencyCode; label: string; symbol: string; flag: string }[] = [
  { code: 'EUR', label: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'USD', label: 'Dollar américain', symbol: '$', flag: '🇺🇸' },
  { code: 'GBP', label: 'Livre sterling', symbol: '£', flag: '🇬🇧' },
  { code: 'CHF', label: 'Franc suisse', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'CAD', label: 'Dollar canadien', symbol: 'CA$', flag: '🇨🇦' },
];

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-slate-700">
        <span className="text-indigo-500">{icon}</span>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

export default function Settings() {
  const { currentUser, updateUser, logout } = useAuth();
  const { currentTheme, themeMode, setThemeMode } = useTheme();
  const { importData, resetData, categories, expenses, incomes, budgets } = useData();

  // Profile form
  const [profileForm, setProfileForm] = useState({
    username: currentUser?.username ?? '',
    email: currentUser?.email ?? '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    newPass: '',
    confirm: '',
  });
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Location
  const [locLoading, setLocLoading] = useState(false);
  const [locName, setLocName] = useState(currentUser?.settings?.location?.name ?? '');
  const [locLat, setLocLat] = useState(currentUser?.settings?.location?.lat?.toString() ?? '');
  const [locLon, setLocLon] = useState(currentUser?.settings?.location?.lon?.toString() ?? '');

  // Modals
  const [resetConfirm, setResetConfirm] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState(false);

  const sunTimes = (() => {
    try {
      const lat = parseFloat(locLat) || currentUser?.settings?.location?.lat || 48.8566;
      const lon = parseFloat(locLon) || currentUser?.settings?.location?.lon || 2.3522;
      return getSunTimes(lat, lon);
    } catch {
      return null;
    }
  })();

  const handleProfileSave = () => {
    if (!profileForm.username.trim() || !profileForm.email.trim()) {
      setProfileMsg({ type: 'error', text: 'Tous les champs sont requis.' });
      return;
    }
    updateUser({ username: profileForm.username, email: profileForm.email });
    setProfileMsg({ type: 'success', text: 'Profil mis à jour.' });
    setTimeout(() => setProfileMsg(null), 3000);
  };

  const handlePasswordSave = () => {
    if (!passwordForm.current || !passwordForm.newPass) {
      setPasswordMsg({ type: 'error', text: 'Remplissez tous les champs.' });
      return;
    }
    const expected = btoa(passwordForm.current + 'fm_salt');
    if (expected !== currentUser?.passwordHash) {
      setPasswordMsg({ type: 'error', text: 'Mot de passe actuel incorrect.' });
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      setPasswordMsg({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas.' });
      return;
    }
    if (passwordForm.newPass.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Minimum 6 caractères.' });
      return;
    }
    updateUser({ passwordHash: btoa(passwordForm.newPass + 'fm_salt') });
    setPasswordForm({ current: '', newPass: '', confirm: '' });
    setPasswordMsg({ type: 'success', text: 'Mot de passe modifié.' });
    setTimeout(() => setPasswordMsg(null), 3000);
  };

  const detectLocation = () => {
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lon = pos.coords.longitude.toFixed(4);
        setLocLat(lat);
        setLocLon(lon);
        const name = `${lat}°N, ${lon}°E`;
        setLocName(name);
        updateUser({
          settings: {
            ...currentUser!.settings,
            location: { lat: parseFloat(lat), lon: parseFloat(lon), name },
          },
        });
        setLocLoading(false);
      },
      () => setLocLoading(false)
    );
  };

  const saveLocation = () => {
    const lat = parseFloat(locLat);
    const lon = parseFloat(locLon);
    if (isNaN(lat) || isNaN(lon)) return;
    const name = locName || `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
    updateUser({
      settings: { ...currentUser!.settings, location: { lat, lon, name } },
    });
  };

  const handleCurrencyChange = (code: CurrencyCode) => {
    updateUser({ settings: { ...currentUser!.settings, currency: code } });
  };

  const handleExport = () => {
    const data = { categories, expenses, incomes, budgets };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financemanager-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          importData(data);
        } catch {
          alert('Fichier JSON invalide.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleReset = () => {
    resetData();
    setResetConfirm(false);
  };

  const handleDeleteAccount = () => {
    logout();
  };

  const initial = currentUser?.username?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile */}
      <Section title="Profil" icon={<User className="w-5 h-5" />}>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
            {initial}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{currentUser?.username}</p>
            <p className="text-sm text-gray-400">{currentUser?.email}</p>
            <p className="text-xs text-gray-400">
              Membre depuis {currentUser?.createdAt
                ? format(new Date(currentUser.createdAt), 'd MMMM yyyy', { locale: fr })
                : '—'}
            </p>
          </div>
        </div>

        {profileMsg && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            profileMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          }`}>
            {profileMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {profileMsg.text}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom d'utilisateur</label>
            <input
              value={profileForm.username}
              onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <button
          onClick={handleProfileSave}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all"
        >
          Sauvegarder le profil
        </button>
      </Section>

      {/* Password */}
      <Section title="Mot de passe" icon={<Lock className="w-5 h-5" />}>
        {passwordMsg && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
            passwordMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          }`}>
            {passwordMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {passwordMsg.text}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mot de passe actuel</label>
            <input
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nouveau</label>
              <input
                type="password"
                value={passwordForm.newPass}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmer</label>
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>
        <button
          onClick={handlePasswordSave}
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all"
        >
          Changer le mot de passe
        </button>
      </Section>

      {/* Theme */}
      <Section title="Apparence" icon={<Palette className="w-5 h-5" />}>
        <div className="space-y-3">
          {([
            { mode: 'light' as ThemeMode, label: 'Clair', icon: <Sun className="w-5 h-5" />, desc: 'Interface claire' },
            { mode: 'dark' as ThemeMode, label: 'Sombre', icon: <Moon className="w-5 h-5" />, desc: 'Interface sombre' },
            { mode: 'auto' as ThemeMode, label: 'Automatique', icon: <Laptop className="w-5 h-5" />, desc: 'Basé sur le lever/coucher du soleil' },
          ]).map(({ mode, label, icon, desc }) => (
            <button
              key={mode}
              onClick={() => setThemeMode(mode)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                themeMode === mode
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              <span className={themeMode === mode ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500'}>
                {icon}
              </span>
              <div>
                <p className={`font-medium ${themeMode === mode ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                  {label}
                </p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              {themeMode === mode && (
                <div className="ml-auto w-2 h-2 rounded-full bg-indigo-500" />
              )}
            </button>
          ))}
        </div>
      </Section>

      {/* Location */}
      <Section title="Localisation (thème Auto)" icon={<MapPin className="w-5 h-5" />}>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Utilisée pour calculer le lever et coucher du soleil en mode automatique.
        </p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Latitude</label>
            <input
              value={locLat}
              onChange={(e) => setLocLat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="48.8566"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Longitude</label>
            <input
              value={locLon}
              onChange={(e) => setLocLon(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="2.3522"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nom de la localisation</label>
            <input
              value={locName}
              onChange={(e) => setLocName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="ex: Paris"
            />
          </div>
        </div>
        <div className="flex gap-3 mb-4">
          <button
            onClick={detectLocation}
            disabled={locLoading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          >
            <Navigation className="w-4 h-4" />
            {locLoading ? 'Détection...' : 'Détecter automatiquement'}
          </button>
          <button
            onClick={saveLocation}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
          >
            Sauvegarder
          </button>
        </div>
        {sunTimes && (
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <Sun className="w-4 h-4 text-amber-500" />
              <span className="text-gray-700 dark:text-gray-300">
                Lever: {format(sunTimes.sunrise, 'HH:mm')}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <Moon className="w-4 h-4 text-indigo-500" />
              <span className="text-gray-700 dark:text-gray-300">
                Coucher: {format(sunTimes.sunset, 'HH:mm')}
              </span>
            </div>
          </div>
        )}
      </Section>

      {/* Currency */}
      <Section title="Devise" icon={<DollarSign className="w-5 h-5" />}>
        <div className="space-y-2">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => handleCurrencyChange(c.code)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl border-2 transition-all text-left ${
                currentUser?.settings?.currency === c.code
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
            >
              <span className="text-2xl">{c.flag}</span>
              <div>
                <span className={`font-medium ${currentUser?.settings?.currency === c.code ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                  {c.code}
                </span>
                <span className="text-sm text-gray-400 ml-2">{c.label}</span>
              </div>
              <span className="ml-auto text-lg font-semibold text-gray-400">{c.symbol}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Data */}
      <Section title="Données" icon={<Database className="w-5 h-5" />}>
        <div className="space-y-3">
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-3 p-4 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all text-left"
          >
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
              <Download className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Exporter les données</p>
              <p className="text-xs text-gray-400">Télécharger un fichier JSON avec toutes vos données</p>
            </div>
          </button>

          <button
            onClick={handleImport}
            className="w-full flex items-center gap-3 p-4 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all text-left"
          >
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Importer des données</p>
              <p className="text-xs text-gray-400">Charger un fichier JSON exporté précédemment</p>
            </div>
          </button>

          <button
            onClick={() => setResetConfirm(true)}
            className="w-full flex items-center gap-3 p-4 border border-amber-200 dark:border-amber-800 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all text-left"
          >
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400">Réinitialiser les données</p>
              <p className="text-xs text-amber-500 dark:text-amber-500">Supprimer toutes les dépenses, revenus, catégories et budgets</p>
            </div>
          </button>
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="Zone de danger" icon={<AlertCircle className="w-5 h-5 text-red-500" />}>
        <button
          onClick={() => setDeleteAccountConfirm(true)}
          className="w-full flex items-center gap-3 p-4 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-left"
        >
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="font-medium text-red-700 dark:text-red-400">Supprimer le compte</p>
            <p className="text-xs text-red-400">Se déconnecte et supprime la session</p>
          </div>
        </button>
      </Section>

      {/* Reset confirm */}
      <Modal
        isOpen={resetConfirm}
        onClose={() => setResetConfirm(false)}
        title="Réinitialiser les données"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setResetConfirm(false)}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
            >
              Annuler
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
            >
              Réinitialiser
            </button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Toutes vos données (dépenses, revenus, catégories, budgets) seront définitivement supprimées. Cette action est irréversible.
        </p>
      </Modal>

      {/* Delete account confirm */}
      <Modal
        isOpen={deleteAccountConfirm}
        onClose={() => setDeleteAccountConfirm(false)}
        title="Supprimer le compte"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteAccountConfirm(false)}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
            >
              Annuler
            </button>
            <button
              onClick={handleDeleteAccount}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
            >
              Confirmer
            </button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Vous serez déconnecté. Vos données restent stockées localement.
        </p>
      </Modal>
    </div>
  );
}
