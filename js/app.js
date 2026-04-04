/* Finance Manager — app.js */
'use strict';

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatCurrency(amount) {
  const currency = getSettings().currency || 'EUR';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Intl.DateTimeFormat('fr-FR').format(new Date(dateStr + 'T00:00:00'));
}

function currentMonth() {
  const now = new Date();
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

function monthLabel(yyyyMm) {
  const [y, m] = yyyyMm.split('-');
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
    .format(new Date(+y, +m - 1, 1));
}

function addMonths(yyyyMm, n) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toISO(d) {
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

function getPeriodDates(type) {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth();
  let start, end;
  switch (type) {
    case 'month':
      start = new Date(y, m, 1);
      end   = new Date(y, m + 1, 0);
      break;
    case 'quarter': {
      const q = Math.floor(m / 3);
      start = new Date(y, q * 3, 1);
      end   = new Date(y, q * 3 + 3, 0);
      break;
    }
    case 'semester': {
      const s = m < 6 ? 0 : 1;
      start = new Date(y, s * 6, 1);
      end   = new Date(y, s * 6 + 6, 0);
      break;
    }
    case 'year':
    default:
      start = new Date(y, 0, 1);
      end   = new Date(y, 11, 31);
      break;
  }
  return { start: toISO(start), end: toISO(end) };
}

function inPeriod(dateStr, start, end) {
  if (!dateStr) return false;
  return dateStr >= start && dateStr <= end;
}

const RECURRENCE_LABELS = {
  monthly:    'Mensuel',
  bimonthly:  'Bimensuel',
  quarterly:  'Trimestriel',
  semiannual: 'Semestriel',
  annual:     'Annuel',
};

// ═══════════════════════════════════════════════════════════════
//  PERSISTENCE
// ═══════════════════════════════════════════════════════════════

const KEYS = {
  accounts:   'fm_accounts',
  expenses:   'fm_expenses',
  incomes:    'fm_incomes',
  categories: 'fm_categories',
  budgets:    'fm_budgets',
  settings:   'fm_settings',
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch (_) { return fallback; }
}

function save(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (_) {}
}

function getAccounts()   { return load(KEYS.accounts,   []); }
function getExpenses()   { return load(KEYS.expenses,   []); }
function getIncomes()    { return load(KEYS.incomes,    []); }
function getCategories() { return load(KEYS.categories, []); }
function getBudgets()    { return load(KEYS.budgets,    []); }
function getSettings()   {
  return load(KEYS.settings, {
    currency: 'EUR',
    theme: 'auto',
    statusConfirmation: false,
    profile: { name: '', email: '' },
  });
}

function saveAccounts(d)   { save(KEYS.accounts,   d); }
function saveExpenses(d)   { save(KEYS.expenses,   d); }
function saveIncomes(d)    { save(KEYS.incomes,    d); }
function saveCategories(d) { save(KEYS.categories, d); }
function saveBudgets(d)    { save(KEYS.budgets,    d); }
function saveSettings(d)   { save(KEYS.settings,   d); }

function seedCategories() {
  if (getCategories().length === 0) {
    saveCategories([
      { id: uid(), name: 'Alimentation', color: '#22c55e', type: 'expense' },
      { id: uid(), name: 'Transport',    color: '#3b82f6', type: 'expense' },
      { id: uid(), name: 'Logement',     color: '#f59e0b', type: 'expense' },
      { id: uid(), name: 'Loisirs',      color: '#ec4899', type: 'expense' },
      { id: uid(), name: 'Santé',        color: '#14b8a6', type: 'expense' },
      { id: uid(), name: 'Salaire',      color: '#8b5cf6', type: 'income'  },
      { id: uid(), name: 'Autre',        color: '#64748b', type: 'both'    },
    ]);
  }
}

// ═══════════════════════════════════════════════════════════════
//  THEME MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const THEMES = ['auto', 'dark', 'light'];
const THEME_LABELS = { auto: 'Auto', dark: 'Sombre', light: 'Clair' };

function applyTheme(theme) {
  const body = document.body;
  body.removeAttribute('data-theme');
  if (theme === 'dark')  body.setAttribute('data-theme', 'dark');
  if (theme === 'light') body.setAttribute('data-theme', 'light');
  // auto = no attribute, use CSS media query
  const btn = document.querySelector('.btn--auto');
  if (btn) btn.textContent = THEME_LABELS[theme] || 'Auto';
}

function cycleTheme() {
  const settings = getSettings();
  const cur  = settings.theme || 'auto';
  const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
  saveSettings({ ...settings, theme: next });
  applyTheme(next);
}

// ═══════════════════════════════════════════════════════════════
//  ICONS
// ═══════════════════════════════════════════════════════════════

function iconDashboard() {
  return '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>';
}
function iconAccounts() {
  return '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>';
}
function iconExpenses() {
  return '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
}
function iconIncomes() {
  return '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>';
}
function iconCategories() {
  return '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
}
function iconBudgets() {
  return '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>';
}
function iconForecast() {
  return '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>';
}
function iconSettings() {
  return '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
}
function iconEdit() {
  return '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
}
function iconDelete() {
  return '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
}

// ═══════════════════════════════════════════════════════════════
//  TAB NAVIGATION
// ═══════════════════════════════════════════════════════════════

let activeTab = 'dashboard';

const TABS = [
  { id: 'dashboard',  label: 'Tableau de bord', icon: iconDashboard  },
  { id: 'expenses',   label: 'Dépenses',         icon: iconExpenses   },
  { id: 'incomes',    label: 'Revenus',           icon: iconIncomes    },
  { id: 'categories', label: 'Catégories',        icon: iconCategories },
  { id: 'budgets',    label: 'Budgets',           icon: iconBudgets    },
  { id: 'forecast',   label: 'Prévisionnel',      icon: iconForecast   },
  { id: 'accounts',   label: 'Comptes',           icon: iconAccounts   },
  { id: 'settings',   label: 'Paramètres',        icon: iconSettings   },
];

function buildTabNav() {
  const nav = document.getElementById('tab-nav');
  nav.innerHTML = TABS.map(t => `
    <button
      class="nav-item${t.id === activeTab ? ' nav-item--active' : ''}"
      aria-current="${t.id === activeTab ? 'page' : 'false'}"
      data-tab="${t.id}"
    >${t.icon()}<span class="nav-item__label">${escHtml(t.label)}</span></button>
  `).join('');

  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.nav-item').forEach(btn => {
    const active = btn.dataset.tab === tabId;
    btn.classList.toggle('nav-item--active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
  const tab = TABS.find(t => t.id === tabId);
  const titleEl = document.getElementById('page-title');
  if (tab && titleEl) titleEl.textContent = tab.label;
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggle  = document.getElementById('sidebar-toggle');
  if (sidebar && sidebar.classList.contains('sidebar--open')) {
    sidebar.classList.remove('sidebar--open');
    if (overlay) { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); }
    if (toggle)  toggle.setAttribute('aria-expanded', 'false');
  }
  renderActivePanel();
}

function renderActivePanel() {
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.hidden = true;
    p.setAttribute('aria-hidden', 'true');
  });
  const panel = document.getElementById('panel-' + activeTab);
  if (!panel) return;
  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');

  switch (activeTab) {
    case 'dashboard':  renderDashboard(panel);  break;
    case 'accounts':   renderAccounts(panel);   break;
    case 'expenses':   renderExpenses(panel);   break;
    case 'incomes':    renderIncomes(panel);     break;
    case 'categories': renderCategories(panel); break;
    case 'budgets':    renderBudgets(panel);    break;
    case 'forecast':   renderForecast(panel);   break;
    case 'settings':   renderSettings(panel);   break;
  }
}

// ═══════════════════════════════════════════════════════════════
//  PROFILE MENU
// ═══════════════════════════════════════════════════════════════

function buildProfileMenu() {
  const avatar = document.querySelector('.user-avatar');
  if (!avatar) return;
  avatar.setAttribute('role', 'button');
  avatar.setAttribute('tabindex', '0');
  avatar.setAttribute('aria-haspopup', 'true');
  avatar.setAttribute('aria-expanded', 'false');

  const settings = getSettings();
  const profile  = settings.profile || {};
  const initials = profile.name
    ? profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'A';
  avatar.querySelector('span').textContent = initials;

  avatar.addEventListener('click', e => {
    e.stopPropagation();
    toggleProfileMenu();
  });
  avatar.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleProfileMenu(); }
  });
}

function toggleProfileMenu() {
  let menu = document.getElementById('profile-menu');
  if (menu) { menu.remove(); document.querySelector('.user-avatar')?.setAttribute('aria-expanded', 'false'); return; }

  const settings = getSettings();
  const profile  = settings.profile || {};
  menu = document.createElement('div');
  menu.id = 'profile-menu';
  menu.className = 'profile-menu';
  menu.innerHTML = `
    <div class="profile-menu__header">
      <div class="profile-menu__name">${escHtml(profile.name || 'Utilisateur')}</div>
      <div class="profile-menu__email">${escHtml(profile.email || 'Non renseigné')}</div>
    </div>
    <div class="profile-menu__divider"></div>
    <button class="profile-menu__item" id="pm-settings">
      ${iconSettings()} Paramètres
    </button>
    <div class="profile-menu__divider"></div>
    <button class="profile-menu__item profile-menu__item--danger" id="pm-logout">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Se déconnecter
    </button>`;

  document.querySelector('.user-avatar').setAttribute('aria-expanded', 'true');
  document.body.appendChild(menu);

  menu.querySelector('#pm-settings').addEventListener('click', () => {
    menu.remove();
    switchTab('settings');
  });
  menu.querySelector('#pm-logout').addEventListener('click', () => {
    menu.remove();
    showToast('Déconnexion simulée (aucun backend configuré).', 'success');
  });

  setTimeout(() => {
    document.addEventListener('click', () => {
      menu.remove();
      document.querySelector('.user-avatar')?.setAttribute('aria-expanded', 'false');
    }, { once: true });
  }, 0);
}

// ═══════════════════════════════════════════════════════════════
//  PERIOD SELECTOR (shared component)
// ═══════════════════════════════════════════════════════════════

function buildPeriodBar(panel, renderFn) {
  const type  = panel.dataset.periodType  || 'month';
  const start = panel.dataset.periodStart || getPeriodDates('month').start;
  const end   = panel.dataset.periodEnd   || getPeriodDates('month').end;

  const shortcuts = [
    { key: 'month',    label: 'Ce mois'     },
    { key: 'quarter',  label: 'Ce trimestre' },
    { key: 'semester', label: 'Ce semestre'  },
    { key: 'year',     label: 'Cette année'  },
  ];

  return `
    <div class="period-bar">
      <div class="period-bar__shortcuts">
        ${shortcuts.map(s => `
          <button class="period-btn${type === s.key ? ' period-btn--active' : ''}" data-period="${s.key}">${s.label}</button>
        `).join('')}
        <button class="period-btn${type === 'custom' ? ' period-btn--active' : ''}" data-period="custom">Personnalisé</button>
      </div>
      <div class="period-bar__custom${type === 'custom' ? '' : ' period-bar__custom--hidden'}" id="period-custom-${panel.id}">
        <label class="sr-only" for="p-start-${panel.id}">Du</label>
        <input type="date" class="form-input form-input--date" id="p-start-${panel.id}" value="${escHtml(start)}">
        <span class="period-bar__sep">→</span>
        <label class="sr-only" for="p-end-${panel.id}">Au</label>
        <input type="date" class="form-input form-input--date" id="p-end-${panel.id}" value="${escHtml(end)}">
      </div>
    </div>`;
}

function initPeriodBar(panel, renderFn) {
  const bar = panel.querySelector('.period-bar');
  if (!bar) return;

  bar.querySelectorAll('.period-btn[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.period;
      if (p !== 'custom') {
        const dates = getPeriodDates(p);
        panel.dataset.periodType  = p;
        panel.dataset.periodStart = dates.start;
        panel.dataset.periodEnd   = dates.end;
      } else {
        panel.dataset.periodType = 'custom';
      }
      renderFn(panel);
    });
  });

  const startInput = panel.querySelector(`#p-start-${panel.id}`);
  const endInput   = panel.querySelector(`#p-end-${panel.id}`);
  if (startInput) startInput.addEventListener('change', e => {
    panel.dataset.periodStart = e.target.value;
    renderFn(panel);
  });
  if (endInput) endInput.addEventListener('change', e => {
    panel.dataset.periodEnd = e.target.value;
    renderFn(panel);
  });
}

function getPanelPeriod(panel) {
  const type  = panel.dataset.periodType;
  if (!type) {
    const d = getPeriodDates('month');
    return d;
  }
  if (type !== 'custom') return getPeriodDates(type);
  return {
    start: panel.dataset.periodStart || getPeriodDates('month').start,
    end:   panel.dataset.periodEnd   || getPeriodDates('month').end,
  };
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════

function renderDashboard(panel) {
  const accounts   = getAccounts();
  const expenses   = getExpenses();
  const incomes    = getIncomes();
  const categories = getCategories();

  // Init period if not set
  if (!panel.dataset.periodType) {
    const d = getPeriodDates('month');
    panel.dataset.periodType  = 'month';
    panel.dataset.periodStart = d.start;
    panel.dataset.periodEnd   = d.end;
  }
  const { start, end } = getPanelPeriod(panel);

  const totalBalance  = accounts.reduce((s, a) => s + a.balance, 0);
  const periodExp     = expenses.filter(e => inPeriod(e.date, start, end));
  const periodInc     = incomes.filter(i => inPeriod(i.date, start, end));
  const totalPeriodExp = periodExp.reduce((s, e) => s + e.amount, 0);
  const totalPeriodInc = periodInc.reduce((s, i) => s + i.amount, 0);

  // Expenses by category for the period
  const expByCat = {};
  periodExp.forEach(e => {
    if (e.categoryId) expByCat[e.categoryId] = (expByCat[e.categoryId] || 0) + e.amount;
  });

  // Recent transactions (last 5) in period
  const allTx = [
    ...periodExp.map(e => ({ ...e, type: 'expense' })),
    ...periodInc.map(i => ({ ...i, type: 'income'  })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);

  panel.innerHTML = `
    ${buildPeriodBar(panel, renderDashboard)}

    <div class="summary-grid">
      <div class="summary-card summary-card--balance">
        <span class="summary-card__label">Solde total</span>
        <span class="summary-card__value">${formatCurrency(totalBalance)}</span>
      </div>
      <div class="summary-card summary-card--expense">
        <span class="summary-card__label">Dépenses de la période</span>
        <span class="summary-card__value">${formatCurrency(totalPeriodExp)}</span>
      </div>
      <div class="summary-card summary-card--income">
        <span class="summary-card__label">Revenus de la période</span>
        <span class="summary-card__value">${formatCurrency(totalPeriodInc)}</span>
      </div>
    </div>

    ${Object.keys(expByCat).length > 0 ? `
      <section class="section">
        <h2 class="section__title">Dépenses par catégorie</h2>
        ${buildBarChart(expByCat, categories)}
      </section>
    ` : ''}

    <section class="section">
      <h2 class="section__title">Transactions récentes</h2>
      ${allTx.length === 0
        ? '<div class="empty-state"><p>Aucune transaction pour cette période.</p></div>'
        : `<ul class="tx-list" role="list">
            ${allTx.map(tx => {
              const cat = categories.find(c => c.id === tx.categoryId);
              const acc = accounts.find(a => a.id === tx.accountId);
              const sign = tx.type === 'expense' ? '−' : '+';
              const amtClass = tx.type === 'expense' ? 'tx-item__amount--expense' : 'tx-item__amount--income';
              return `
                <li class="tx-item">
                  <span class="tx-item__dot" style="background:${escHtml(cat ? cat.color : '#64748b')}" aria-hidden="true"></span>
                  <span class="tx-item__label">${escHtml(tx.label)}</span>
                  <span class="tx-item__account">${escHtml(acc ? acc.name : '—')}</span>
                  <span class="tx-item__date">${formatDate(tx.date)}</span>
                  <span class="tx-item__amount ${amtClass}">${sign}${formatCurrency(tx.amount)}</span>
                </li>`;
            }).join('')}
          </ul>`
      }
    </section>
  `;

  initPeriodBar(panel, renderDashboard);
}

function buildBarChart(expByCat, categories) {
  const entries  = Object.entries(expByCat);
  const maxVal   = Math.max(...entries.map(([, v]) => v));
  const rowH     = 32;
  const gap      = 8;
  const labelW   = 110;
  const barMaxW  = 180;
  const valueW   = 100;
  const totalH   = entries.length * (rowH + gap) - gap;
  const svgW     = labelW + barMaxW + valueW + 16;

  const rows = entries.map(([catId, val], i) => {
    const cat   = categories.find(c => c.id === catId);
    const color = cat ? cat.color : '#64748b';
    const name  = cat ? cat.name  : 'Autre';
    const barW  = Math.max(4, (val / maxVal) * barMaxW);
    const y     = i * (rowH + gap);
    const midY  = y + rowH / 2;
    return `
      <text x="${labelW - 8}" y="${midY + 5}" text-anchor="end" font-size="13" fill="#94a3b8" font-family="system-ui,sans-serif">${escHtml(name)}</text>
      <rect x="${labelW}" y="${y}" width="${barW}" height="${rowH}" rx="5" fill="${escHtml(color)}" opacity="0.85"/>
      <text x="${labelW + barW + 8}" y="${midY + 5}" font-size="13" fill="#e2e8f0" font-family="system-ui,sans-serif" font-weight="600">${formatCurrency(val)}</text>`;
  }).join('');

  return `
    <div class="chart-wrapper" role="img" aria-label="Graphique des dépenses par catégorie">
      <svg viewBox="0 0 ${svgW} ${totalH + 4}" width="100%" style="overflow:visible;max-width:500px;display:block">
        ${rows}
      </svg>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  ACCOUNTS
// ═══════════════════════════════════════════════════════════════

function renderAccounts(panel) {
  const accounts = getAccounts();

  panel.innerHTML = `
    <div class="page-header">
      <button class="btn btn--primary btn--sm" id="btn-add-account">+ Ajouter</button>
    </div>
    ${accounts.length === 0
      ? '<div class="empty-state"><p>Aucun compte. Créez votre premier compte pour commencer.</p></div>'
      : `<ul class="item-list" role="list">
          ${accounts.map(acc => `
            <li class="item-card">
              <div class="item-card__info">
                <span class="item-card__name">${escHtml(acc.name)}</span>
                <span class="item-card__meta">Solde actuel</span>
              </div>
              <span class="item-card__amount" style="font-size:1.125rem;color:${acc.balance < 0 ? '#ef4444' : 'var(--color-text)'}">${formatCurrency(acc.balance)}</span>
              <div class="item-card__actions">
                <button class="btn-icon btn-icon--edit" data-id="${escHtml(acc.id)}" aria-label="Modifier ${escHtml(acc.name)}">${iconEdit()}</button>
                <button class="btn-icon btn-icon--delete" data-id="${escHtml(acc.id)}" aria-label="Supprimer ${escHtml(acc.name)}">${iconDelete()}</button>
              </div>
            </li>`).join('')}
        </ul>`
    }`;

  panel.querySelector('#btn-add-account').addEventListener('click', () => openAccountForm());
  panel.querySelectorAll('.btn-icon--edit').forEach(btn =>
    btn.addEventListener('click', () => openAccountForm(btn.dataset.id)));
  panel.querySelectorAll('.btn-icon--delete').forEach(btn =>
    btn.addEventListener('click', () => deleteAccount(btn.dataset.id)));
}

function openAccountForm(id) {
  const acc = id ? getAccounts().find(a => a.id === id) : null;
  openModal(acc ? 'Modifier le compte' : 'Nouveau compte', `
    <form id="account-form" class="form" novalidate>
      <div class="form-group">
        <label for="acc-name" class="form-label">Nom <span aria-hidden="true">*</span></label>
        <input id="acc-name" name="name" type="text" class="form-input" value="${escHtml(acc ? acc.name : '')}" required autocomplete="off">
      </div>
      <div class="form-group">
        <label for="acc-balance" class="form-label">Solde initial (${getSettings().currency || 'EUR'})</label>
        <input id="acc-balance" name="balance" type="number" step="0.01" class="form-input" value="${acc ? acc.balance : '0'}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="modal-cancel">Annuler</button>
        <button type="submit" class="btn btn--primary">${acc ? 'Modifier' : 'Créer'}</button>
      </div>
    </form>`);

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('account-form').addEventListener('submit', e => {
    e.preventDefault();
    const name    = e.target.name.value.trim();
    const balance = parseFloat(e.target.balance.value) || 0;
    if (!name) { showToast('Le nom est requis.', 'error'); return; }
    const accounts = getAccounts();
    if (acc) {
      const idx = accounts.findIndex(a => a.id === acc.id);
      accounts[idx] = { ...accounts[idx], name, balance };
    } else {
      accounts.push({ id: uid(), name, balance });
    }
    saveAccounts(accounts);
    closeModal();
    showToast(acc ? 'Compte modifié.' : 'Compte créé.', 'success');
    renderAccounts(document.getElementById('panel-accounts'));
  });
}

function deleteAccount(id) {
  if (!confirm('Supprimer ce compte ? Les transactions liées ne seront pas supprimées.')) return;
  saveAccounts(getAccounts().filter(a => a.id !== id));
  showToast('Compte supprimé.', 'success');
  renderAccounts(document.getElementById('panel-accounts'));
}

// ═══════════════════════════════════════════════════════════════
//  EXPENSES
// ═══════════════════════════════════════════════════════════════

function renderExpenses(panel) {
  const accounts   = getAccounts();
  const categories = getCategories();

  if (!panel.dataset.periodType) {
    const d = getPeriodDates('month');
    panel.dataset.periodType  = 'month';
    panel.dataset.periodStart = d.start;
    panel.dataset.periodEnd   = d.end;
  }
  const { start, end } = getPanelPeriod(panel);

  const filtered = getExpenses()
    .filter(e => inPeriod(e.date, start, end))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  panel.innerHTML = `
    <div class="page-header">
      <button class="btn btn--primary btn--sm" id="btn-add-expense">+ Ajouter</button>
    </div>
    ${buildPeriodBar(panel, renderExpenses)}
    ${filtered.length === 0
      ? '<div class="empty-state"><p>Aucune dépense pour cette période.</p></div>'
      : `<div class="table-wrapper">
          <table class="data-table" aria-label="Liste des dépenses">
            <thead>
              <tr>
                <th>NOM</th>
                <th class="col-center">CATÉGORIE</th>
                <th class="col-center">MONTANT</th>
                <th>DATE</th>
                <th>COMPTE</th>
                <th>RÉCURRENCE</th>
                <th class="col-center">STATUT</th>
                <th class="col-actions">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(exp => {
                const acc = accounts.find(a => a.id === exp.accountId);
                const cat = categories.find(c => c.id === exp.categoryId);
                const catColor = cat ? cat.color : '#64748b';
                const catBg = catColor + '28';
                const statusClass = exp.debited ? 'status-btn--paid' : 'status-btn--pending';
                const statusLabel = exp.debited ? 'Payé' : 'En attente';
                return `
                  <tr>
                    <td class="col-name">
                      ${escHtml(exp.label)}
                      ${exp.notes ? `<span class="row-note" title="${escHtml(exp.notes)}">📝</span>` : ''}
                    </td>
                    <td class="col-center">
                      ${cat
                        ? `<span class="cat-badge" style="background:${catBg};color:${escHtml(catColor)}">${escHtml(cat.name)}</span>`
                        : '<span class="text-muted">—</span>'}
                    </td>
                    <td class="col-amount col-center">${formatCurrency(exp.amount)}</td>
                    <td class="text-muted">${formatDate(exp.date)}</td>
                    <td class="text-muted">${escHtml(acc ? acc.name : '—')}</td>
                    <td class="text-muted">
                      ${exp.recurrence ? `<span class="badge badge--recurring">${escHtml(RECURRENCE_LABELS[exp.recurrence] || exp.recurrence)}</span>` : '—'}
                    </td>
                    <td class="col-center">
                      <button class="status-btn ${statusClass}" data-id="${escHtml(exp.id)}" data-type="expense" aria-label="Statut: ${statusLabel}">
                        ${statusLabel}
                      </button>
                    </td>
                    <td class="col-actions">
                      <button class="btn-icon btn-icon--edit" data-id="${escHtml(exp.id)}" aria-label="Modifier">${iconEdit()}</button>
                      <button class="btn-icon btn-icon--delete" data-id="${escHtml(exp.id)}" aria-label="Supprimer">${iconDelete()}</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`
    }`;

  panel.querySelector('#btn-add-expense').addEventListener('click', () => openExpenseForm());
  initPeriodBar(panel, renderExpenses);

  panel.querySelectorAll('.status-btn[data-type="expense"]').forEach(btn =>
    btn.addEventListener('click', () => toggleExpenseStatus(btn.dataset.id)));
  panel.querySelectorAll('.btn-icon--edit').forEach(btn =>
    btn.addEventListener('click', () => openExpenseForm(btn.dataset.id)));
  panel.querySelectorAll('.btn-icon--delete').forEach(btn =>
    btn.addEventListener('click', () => deleteExpense(btn.dataset.id)));
}

function openExpenseForm(id) {
  const accounts   = getAccounts();
  const categories = getCategories();
  const exp        = id ? getExpenses().find(e => e.id === id) : null;

  if (accounts.length === 0) { showToast('Créez d\'abord un compte.', 'error'); return; }

  openModal(exp ? 'Modifier la dépense' : 'Nouvelle dépense', `
    <form id="expense-form" class="form" novalidate>
      <div class="form-group">
        <label for="exp-label" class="form-label">Libellé *</label>
        <input id="exp-label" name="label" type="text" class="form-input" value="${escHtml(exp ? exp.label : '')}" required autocomplete="off">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="exp-amount" class="form-label">Montant *</label>
          <input id="exp-amount" name="amount" type="number" step="0.01" min="0.01" class="form-input" value="${exp ? exp.amount : ''}">
        </div>
        <div class="form-group">
          <label for="exp-date" class="form-label">Date</label>
          <input id="exp-date" name="date" type="date" class="form-input" value="${exp ? exp.date : todayISO()}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="exp-account" class="form-label">Compte *</label>
          <select id="exp-account" name="accountId" class="form-select">
            ${accounts.map(a => `<option value="${escHtml(a.id)}"${exp && exp.accountId === a.id ? ' selected' : ''}>${escHtml(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="exp-category" class="form-label">Catégorie</label>
          <select id="exp-category" name="categoryId" class="form-select">
            <option value="">— Aucune —</option>
            ${categories.filter(c => c.type !== 'income').map(c => `<option value="${escHtml(c.id)}"${exp && exp.categoryId === c.id ? ' selected' : ''}>${escHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="exp-recurrence" class="form-label">Récurrence</label>
        <select id="exp-recurrence" name="recurrence" class="form-select">
          <option value="">— Aucune —</option>
          <option value="monthly"${exp && exp.recurrence === 'monthly' ? ' selected' : ''}>Mensuel</option>
          <option value="bimonthly"${exp && exp.recurrence === 'bimonthly' ? ' selected' : ''}>Bimensuel</option>
          <option value="quarterly"${exp && exp.recurrence === 'quarterly' ? ' selected' : ''}>Trimestriel</option>
          <option value="semiannual"${exp && exp.recurrence === 'semiannual' ? ' selected' : ''}>Semestriel</option>
          <option value="annual"${exp && exp.recurrence === 'annual' ? ' selected' : ''}>Annuel</option>
        </select>
      </div>
      <div class="form-group">
        <label for="exp-notes" class="form-label">Notes</label>
        <textarea id="exp-notes" name="notes" class="form-input form-textarea" rows="2" placeholder="Notes optionnelles…">${escHtml(exp ? (exp.notes || '') : '')}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="modal-cancel">Annuler</button>
        <button type="submit" class="btn btn--primary">${exp ? 'Modifier' : 'Ajouter'}</button>
      </div>
    </form>`);

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('expense-form').addEventListener('submit', e => {
    e.preventDefault();
    const label      = e.target.label.value.trim();
    const amount     = parseFloat(e.target.amount.value);
    const date       = e.target.date.value;
    const accountId  = e.target.accountId.value;
    const categoryId = e.target.categoryId.value || null;
    const recurrence = e.target.recurrence.value || null;
    const notes      = e.target.notes.value.trim() || null;
    if (!label)               { showToast('Le libellé est requis.', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Montant invalide.', 'error'); return; }
    const expenses = getExpenses();
    if (exp) {
      const idx = expenses.findIndex(e => e.id === exp.id);
      expenses[idx] = { ...expenses[idx], label, amount, date, accountId, categoryId, recurrence, notes };
    } else {
      expenses.push({ id: uid(), label, amount, date, accountId, categoryId, recurrence, notes, debited: false });
    }
    saveExpenses(expenses);
    closeModal();
    showToast(exp ? 'Dépense modifiée.' : 'Dépense ajoutée.', 'success');
    renderExpenses(document.getElementById('panel-expenses'));
  });
}

function toggleExpenseStatus(id) {
  const settings = getSettings();
  const expenses = getExpenses();
  const accounts = getAccounts();
  const exp      = expenses.find(e => e.id === id);
  if (!exp) return;

  const newStatus = !exp.debited;
  const label     = newStatus ? 'Marquer comme Payé et débiter ?' : 'Annuler le paiement et rembourser ?';

  if (settings.statusConfirmation) {
    if (!confirm(label)) return;
  }

  const acc = accounts.find(a => a.id === exp.accountId);
  if (!acc) { showToast('Compte introuvable.', 'error'); return; }

  if (newStatus) {
    acc.balance -= exp.amount;
  } else {
    acc.balance += exp.amount;
  }
  exp.debited = newStatus;
  saveExpenses(expenses);
  saveAccounts(accounts);
  showToast(newStatus ? 'Dépense payée.' : 'Paiement annulé.', 'success');
  renderExpenses(document.getElementById('panel-expenses'));
}

function deleteExpense(id) {
  if (!confirm('Supprimer cette dépense ?')) return;
  saveExpenses(getExpenses().filter(e => e.id !== id));
  showToast('Dépense supprimée.', 'success');
  renderExpenses(document.getElementById('panel-expenses'));
}

// ═══════════════════════════════════════════════════════════════
//  INCOMES
// ═══════════════════════════════════════════════════════════════

function renderIncomes(panel) {
  const accounts   = getAccounts();
  const categories = getCategories();

  if (!panel.dataset.periodType) {
    const d = getPeriodDates('month');
    panel.dataset.periodType  = 'month';
    panel.dataset.periodStart = d.start;
    panel.dataset.periodEnd   = d.end;
  }
  const { start, end } = getPanelPeriod(panel);

  const filtered = getIncomes()
    .filter(i => inPeriod(i.date, start, end))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  panel.innerHTML = `
    <div class="page-header">
      <button class="btn btn--primary btn--sm" id="btn-add-income">+ Ajouter</button>
    </div>
    ${buildPeriodBar(panel, renderIncomes)}
    ${filtered.length === 0
      ? '<div class="empty-state"><p>Aucun revenu pour cette période.</p></div>'
      : `<div class="table-wrapper">
          <table class="data-table" aria-label="Liste des revenus">
            <thead>
              <tr>
                <th>NOM</th>
                <th class="col-center">CATÉGORIE</th>
                <th class="col-center">MONTANT</th>
                <th>DATE</th>
                <th>COMPTE</th>
                <th>RÉCURRENCE</th>
                <th class="col-center">STATUT</th>
                <th class="col-actions">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(inc => {
                const acc = accounts.find(a => a.id === inc.accountId);
                const cat = categories.find(c => c.id === inc.categoryId);
                const catColor = cat ? cat.color : '#64748b';
                const catBg = catColor + '28';
                const statusClass = inc.credited ? 'status-btn--paid' : 'status-btn--pending';
                const statusLabel = inc.credited ? 'Reçu' : 'En attente';
                return `
                  <tr>
                    <td class="col-name">
                      ${escHtml(inc.label)}
                      ${inc.notes ? `<span class="row-note" title="${escHtml(inc.notes)}">📝</span>` : ''}
                    </td>
                    <td class="col-center">
                      ${cat
                        ? `<span class="cat-badge" style="background:${catBg};color:${escHtml(catColor)}">${escHtml(cat.name)}</span>`
                        : '<span class="text-muted">—</span>'}
                    </td>
                    <td class="col-amount col-amount--income col-center">+${formatCurrency(inc.amount)}</td>
                    <td class="text-muted">${formatDate(inc.date)}</td>
                    <td class="text-muted">${escHtml(acc ? acc.name : '—')}</td>
                    <td class="text-muted">
                      ${inc.recurrence ? `<span class="badge badge--recurring">${escHtml(RECURRENCE_LABELS[inc.recurrence] || inc.recurrence)}</span>` : '—'}
                    </td>
                    <td class="col-center">
                      <button class="status-btn ${statusClass}" data-id="${escHtml(inc.id)}" data-type="income" aria-label="Statut: ${statusLabel}">
                        ${statusLabel}
                      </button>
                    </td>
                    <td class="col-actions">
                      <button class="btn-icon btn-icon--edit" data-id="${escHtml(inc.id)}" aria-label="Modifier">${iconEdit()}</button>
                      <button class="btn-icon btn-icon--delete" data-id="${escHtml(inc.id)}" aria-label="Supprimer">${iconDelete()}</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`
    }`;

  panel.querySelector('#btn-add-income').addEventListener('click', () => openIncomeForm());
  initPeriodBar(panel, renderIncomes);

  panel.querySelectorAll('.status-btn[data-type="income"]').forEach(btn =>
    btn.addEventListener('click', () => toggleIncomeStatus(btn.dataset.id)));
  panel.querySelectorAll('.btn-icon--edit').forEach(btn =>
    btn.addEventListener('click', () => openIncomeForm(btn.dataset.id)));
  panel.querySelectorAll('.btn-icon--delete').forEach(btn =>
    btn.addEventListener('click', () => deleteIncome(btn.dataset.id)));
}

function openIncomeForm(id) {
  const accounts   = getAccounts();
  const categories = getCategories();
  const inc        = id ? getIncomes().find(i => i.id === id) : null;

  if (accounts.length === 0) { showToast('Créez d\'abord un compte.', 'error'); return; }

  openModal(inc ? 'Modifier le revenu' : 'Nouveau revenu', `
    <form id="income-form" class="form" novalidate>
      <div class="form-group">
        <label for="inc-label" class="form-label">Libellé *</label>
        <input id="inc-label" name="label" type="text" class="form-input" value="${escHtml(inc ? inc.label : '')}" required autocomplete="off">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="inc-amount" class="form-label">Montant *</label>
          <input id="inc-amount" name="amount" type="number" step="0.01" min="0.01" class="form-input" value="${inc ? inc.amount : ''}">
        </div>
        <div class="form-group">
          <label for="inc-date" class="form-label">Date</label>
          <input id="inc-date" name="date" type="date" class="form-input" value="${inc ? inc.date : todayISO()}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="inc-account" class="form-label">Compte *</label>
          <select id="inc-account" name="accountId" class="form-select">
            ${accounts.map(a => `<option value="${escHtml(a.id)}"${inc && inc.accountId === a.id ? ' selected' : ''}>${escHtml(a.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="inc-category" class="form-label">Catégorie</label>
          <select id="inc-category" name="categoryId" class="form-select">
            <option value="">— Aucune —</option>
            ${categories.filter(c => c.type !== 'expense').map(c => `<option value="${escHtml(c.id)}"${inc && inc.categoryId === c.id ? ' selected' : ''}>${escHtml(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label for="inc-recurrence" class="form-label">Récurrence</label>
        <select id="inc-recurrence" name="recurrence" class="form-select">
          <option value="">— Aucune —</option>
          <option value="monthly"${inc && inc.recurrence === 'monthly' ? ' selected' : ''}>Mensuel</option>
          <option value="bimonthly"${inc && inc.recurrence === 'bimonthly' ? ' selected' : ''}>Bimensuel</option>
          <option value="quarterly"${inc && inc.recurrence === 'quarterly' ? ' selected' : ''}>Trimestriel</option>
          <option value="semiannual"${inc && inc.recurrence === 'semiannual' ? ' selected' : ''}>Semestriel</option>
          <option value="annual"${inc && inc.recurrence === 'annual' ? ' selected' : ''}>Annuel</option>
        </select>
      </div>
      <div class="form-group">
        <label for="inc-notes" class="form-label">Notes</label>
        <textarea id="inc-notes" name="notes" class="form-input form-textarea" rows="2" placeholder="Notes optionnelles…">${escHtml(inc ? (inc.notes || '') : '')}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="modal-cancel">Annuler</button>
        <button type="submit" class="btn btn--primary">${inc ? 'Modifier' : 'Ajouter'}</button>
      </div>
    </form>`);

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('income-form').addEventListener('submit', e => {
    e.preventDefault();
    const label      = e.target.label.value.trim();
    const amount     = parseFloat(e.target.amount.value);
    const date       = e.target.date.value;
    const accountId  = e.target.accountId.value;
    const categoryId = e.target.categoryId.value || null;
    const recurrence = e.target.recurrence.value || null;
    const notes      = e.target.notes.value.trim() || null;
    if (!label)               { showToast('Le libellé est requis.', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Montant invalide.', 'error'); return; }
    const incomes = getIncomes();
    if (inc) {
      const idx = incomes.findIndex(i => i.id === inc.id);
      incomes[idx] = { ...incomes[idx], label, amount, date, accountId, categoryId, recurrence, notes };
    } else {
      incomes.push({ id: uid(), label, amount, date, accountId, categoryId, recurrence, notes, credited: false });
    }
    saveIncomes(incomes);
    closeModal();
    showToast(inc ? 'Revenu modifié.' : 'Revenu ajouté.', 'success');
    renderIncomes(document.getElementById('panel-incomes'));
  });
}

function toggleIncomeStatus(id) {
  const settings = getSettings();
  const incomes  = getIncomes();
  const accounts = getAccounts();
  const inc      = incomes.find(i => i.id === id);
  if (!inc) return;

  const newStatus = !inc.credited;
  const label     = newStatus ? 'Marquer comme Reçu et créditer ?' : 'Annuler la réception et débiter ?';

  if (settings.statusConfirmation) {
    if (!confirm(label)) return;
  }

  const acc = accounts.find(a => a.id === inc.accountId);
  if (!acc) { showToast('Compte introuvable.', 'error'); return; }

  if (newStatus) {
    acc.balance += inc.amount;
  } else {
    acc.balance -= inc.amount;
  }
  inc.credited = newStatus;
  saveIncomes(incomes);
  saveAccounts(accounts);
  showToast(newStatus ? 'Revenu reçu.' : 'Réception annulée.', 'success');
  renderIncomes(document.getElementById('panel-incomes'));
}

function deleteIncome(id) {
  if (!confirm('Supprimer ce revenu ?')) return;
  saveIncomes(getIncomes().filter(i => i.id !== id));
  showToast('Revenu supprimé.', 'success');
  renderIncomes(document.getElementById('panel-incomes'));
}

// ═══════════════════════════════════════════════════════════════
//  CATEGORIES
// ═══════════════════════════════════════════════════════════════

function renderCategories(panel) {
  const categories = getCategories();
  const typeLabels = { expense: 'Dépense', income: 'Revenu', both: 'Dépense & Revenu' };

  panel.innerHTML = `
    <div class="page-header">
      <button class="btn btn--primary btn--sm" id="btn-add-cat">+ Ajouter</button>
    </div>
    ${categories.length === 0
      ? '<div class="empty-state"><p>Aucune catégorie.</p></div>'
      : `<div class="cat-grid">
          ${categories.map(cat => {
            const expCount = getExpenses().filter(e => e.categoryId === cat.id).length;
            const incCount = getIncomes().filter(i => i.categoryId === cat.id).length;
            const total    = expCount + incCount;
            const catBg    = cat.color + '28';
            const typeLabel = typeLabels[cat.type] || 'Général';
            return `
              <div class="cat-card">
                <div class="cat-card__top">
                  <span class="cat-card__swatch" style="background:${escHtml(cat.color)}" aria-hidden="true"></span>
                  <div class="cat-card__info">
                    <div class="cat-card__name">${escHtml(cat.name)}</div>
                    <div class="cat-card__type">${escHtml(typeLabel)}</div>
                  </div>
                </div>
                <div class="cat-card__count">${total} élément${total !== 1 ? 's' : ''}</div>
                <div class="cat-card__actions">
                  <button class="btn-icon btn-icon--edit" data-id="${escHtml(cat.id)}" aria-label="Modifier ${escHtml(cat.name)}">${iconEdit()}</button>
                  <button class="btn-icon btn-icon--delete" data-id="${escHtml(cat.id)}" aria-label="Supprimer ${escHtml(cat.name)}">${iconDelete()}</button>
                </div>
              </div>`;
          }).join('')}
        </div>`
    }`;

  panel.querySelector('#btn-add-cat').addEventListener('click', () => openCategoryForm());
  panel.querySelectorAll('.btn-icon--edit').forEach(btn =>
    btn.addEventListener('click', () => openCategoryForm(btn.dataset.id)));
  panel.querySelectorAll('.btn-icon--delete').forEach(btn =>
    btn.addEventListener('click', () => deleteCategory(btn.dataset.id)));
}

function openCategoryForm(id) {
  const cat = id ? getCategories().find(c => c.id === id) : null;
  openModal(cat ? 'Modifier la catégorie' : 'Nouvelle catégorie', `
    <form id="cat-form" class="form" novalidate>
      <div class="form-group">
        <label for="cat-name" class="form-label">Nom *</label>
        <input id="cat-name" name="name" type="text" class="form-input" value="${escHtml(cat ? cat.name : '')}" required autocomplete="off">
      </div>
      <div class="form-group">
        <label for="cat-type" class="form-label">Type</label>
        <select id="cat-type" name="type" class="form-select">
          <option value="expense"${(!cat || cat.type === 'expense') ? ' selected' : ''}>Dépense</option>
          <option value="income"${cat && cat.type === 'income' ? ' selected' : ''}>Revenu</option>
          <option value="both"${cat && cat.type === 'both' ? ' selected' : ''}>Dépense & Revenu</option>
        </select>
      </div>
      <div class="form-group">
        <label for="cat-color" class="form-label">Couleur</label>
        <div class="color-pick-row">
          <input id="cat-color" name="color" type="color" class="form-input form-input--color-sm" value="${cat ? cat.color : '#3b82f6'}">
          <span id="cat-color-preview" class="cat-color-preview" style="background:${cat ? cat.color : '#3b82f6'}"></span>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="modal-cancel">Annuler</button>
        <button type="submit" class="btn btn--primary">${cat ? 'Modifier' : 'Créer'}</button>
      </div>
    </form>`);

  const colorInput   = document.getElementById('cat-color');
  const colorPreview = document.getElementById('cat-color-preview');
  colorInput.addEventListener('input', e => {
    colorPreview.style.background = e.target.value;
  });

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('cat-form').addEventListener('submit', e => {
    e.preventDefault();
    const name  = e.target.name.value.trim();
    const type  = e.target.type.value;
    const color = e.target.color.value;
    if (!name) { showToast('Le nom est requis.', 'error'); return; }
    const categories = getCategories();
    if (cat) {
      const idx = categories.findIndex(c => c.id === cat.id);
      categories[idx] = { ...categories[idx], name, type, color };
    } else {
      categories.push({ id: uid(), name, type, color });
    }
    saveCategories(categories);
    closeModal();
    showToast(cat ? 'Catégorie modifiée.' : 'Catégorie créée.', 'success');
    renderCategories(document.getElementById('panel-categories'));
  });
}

function deleteCategory(id) {
  if (!confirm('Supprimer cette catégorie ?')) return;
  saveCategories(getCategories().filter(c => c.id !== id));
  showToast('Catégorie supprimée.', 'success');
  renderCategories(document.getElementById('panel-categories'));
}

// ═══════════════════════════════════════════════════════════════
//  BUDGETS
// ═══════════════════════════════════════════════════════════════

const BUDGET_RECURRENCE_LABELS = {
  monthly:    'Mensuel',
  bimonthly:  'Bimensuel',
  quarterly:  'Trimestriel',
  semiannual: 'Semestriel',
  annual:     'Annuel',
};

function renderBudgets(panel) {
  const budgets    = getBudgets();
  const categories = getCategories();

  if (!panel.dataset.periodType) {
    const d = getPeriodDates('month');
    panel.dataset.periodType  = 'month';
    panel.dataset.periodStart = d.start;
    panel.dataset.periodEnd   = d.end;
  }
  const { start, end } = getPanelPeriod(panel);

  const periodExpenses = getExpenses().filter(e => inPeriod(e.date, start, end));

  let totalBudget  = 0;
  let totalSpent   = 0;
  let totalRemain  = 0;

  const rows = budgets.map(bud => {
    const cat    = categories.find(c => c.id === bud.categoryId);
    const spent  = periodExpenses.filter(e => e.categoryId === bud.categoryId)
                                 .reduce((s, e) => s + e.amount, 0);
    const pct    = bud.amount > 0 ? Math.min(100, (spent / bud.amount) * 100) : 0;
    const remain = bud.amount - spent;
    const fillClass = pct >= 100 ? 'progress-bar__fill--over'
                    : pct >= 75  ? 'progress-bar__fill--warn'
                    : 'progress-bar__fill--ok';
    const catColor = cat ? cat.color : '#64748b';

    totalBudget += bud.amount;
    totalSpent  += spent;
    totalRemain += remain;

    return `
      <div class="budget-row">
        <div class="budget-row__label">
          <div style="display:flex;align-items:center;gap:0.5rem">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${escHtml(catColor)};flex-shrink:0"></span>
            <span class="budget-row__name">${escHtml(cat ? cat.name : '—')}</span>
            ${bud.recurrence ? `<span class="badge badge--recurring">${escHtml(BUDGET_RECURRENCE_LABELS[bud.recurrence] || bud.recurrence)}</span>` : ''}
            ${bud.showAsExpense ? '<span class="badge badge--budget-exp">→ Dépense</span>' : ''}
          </div>
          <div class="progress-bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="${Math.round(pct)}% du budget utilisé">
            <div class="progress-bar__fill ${fillClass}" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="budget-row__stat">
          <span class="budget-row__stat-label">Budget</span>
          <span class="budget-row__stat-value">${formatCurrency(bud.amount)}</span>
        </div>
        <div class="budget-row__stat">
          <span class="budget-row__stat-label">Dépensé</span>
          <span class="budget-row__stat-value">${formatCurrency(spent)}</span>
        </div>
        <div class="budget-row__stat">
          <span class="budget-row__stat-label">Reste</span>
          <span class="budget-row__stat-value ${remain < 0 ? 'budget-row__stat-value--danger' : 'budget-row__stat-value--success'}">${formatCurrency(remain)}</span>
        </div>
        <div style="display:flex;gap:0.375rem;flex-shrink:0">
          <button class="btn-icon btn-icon--edit" data-id="${escHtml(bud.id)}" aria-label="Modifier le budget">${iconEdit()}</button>
          <button class="btn-icon btn-icon--delete" data-id="${escHtml(bud.id)}" aria-label="Supprimer le budget">${iconDelete()}</button>
        </div>
      </div>`;
  }).join('');

  const totalsRow = budgets.length > 0 ? `
    <div class="budget-row budget-row--total">
      <div class="budget-row__label">
        <span class="budget-row__name">TOTAL</span>
      </div>
      <div class="budget-row__stat">
        <span class="budget-row__stat-label">Budget</span>
        <span class="budget-row__stat-value">${formatCurrency(totalBudget)}</span>
      </div>
      <div class="budget-row__stat">
        <span class="budget-row__stat-label">Dépensé</span>
        <span class="budget-row__stat-value">${formatCurrency(totalSpent)}</span>
      </div>
      <div class="budget-row__stat">
        <span class="budget-row__stat-label">Reste</span>
        <span class="budget-row__stat-value ${totalRemain < 0 ? 'budget-row__stat-value--danger' : 'budget-row__stat-value--success'}">${formatCurrency(totalRemain)}</span>
      </div>
      <div></div>
    </div>` : '';

  panel.innerHTML = `
    <div class="page-header">
      <button class="btn btn--primary btn--sm" id="btn-add-budget">+ Ajouter</button>
    </div>
    ${buildPeriodBar(panel, renderBudgets)}
    ${budgets.length === 0
      ? '<div class="empty-state"><p>Aucun budget défini. Créez des budgets par catégorie.</p></div>'
      : `<div class="budget-table">${rows}${totalsRow}</div>`
    }`;

  panel.querySelector('#btn-add-budget').addEventListener('click', () => openBudgetForm());
  initPeriodBar(panel, renderBudgets);
  panel.querySelectorAll('.btn-icon--edit').forEach(btn =>
    btn.addEventListener('click', () => openBudgetForm(btn.dataset.id)));
  panel.querySelectorAll('.btn-icon--delete').forEach(btn =>
    btn.addEventListener('click', () => deleteBudget(btn.dataset.id)));
}

function openBudgetForm(id) {
  const categories = getCategories();
  const bud        = id ? getBudgets().find(b => b.id === id) : null;

  if (categories.length === 0) { showToast('Créez d\'abord des catégories.', 'error'); return; }

  openModal(bud ? 'Modifier le budget' : 'Nouveau budget', `
    <form id="budget-form" class="form" novalidate>
      <div class="form-group">
        <label for="bud-category" class="form-label">Catégorie *</label>
        <select id="bud-category" name="categoryId" class="form-select">
          ${categories.map(c => `<option value="${escHtml(c.id)}"${bud && bud.categoryId === c.id ? ' selected' : ''}>${escHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="bud-amount" class="form-label">Montant *</label>
        <input id="bud-amount" name="amount" type="number" step="0.01" min="0.01" class="form-input" value="${bud ? bud.amount : ''}">
      </div>
      <div class="form-group">
        <label for="bud-recurrence" class="form-label">Récurrence</label>
        <select id="bud-recurrence" name="recurrence" class="form-select">
          <option value="monthly"${(!bud || bud.recurrence === 'monthly') ? ' selected' : ''}>Mensuel</option>
          <option value="bimonthly"${bud && bud.recurrence === 'bimonthly' ? ' selected' : ''}>Bimensuel</option>
          <option value="quarterly"${bud && bud.recurrence === 'quarterly' ? ' selected' : ''}>Trimestriel</option>
          <option value="semiannual"${bud && bud.recurrence === 'semiannual' ? ' selected' : ''}>Semestriel</option>
          <option value="annual"${bud && bud.recurrence === 'annual' ? ' selected' : ''}>Annuel</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-check">
          <input type="checkbox" name="showAsExpense"${bud && bud.showAsExpense ? ' checked' : ''}>
          <span>Compter le solde restant comme dépense impayée</span>
        </label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="modal-cancel">Annuler</button>
        <button type="submit" class="btn btn--primary">${bud ? 'Modifier' : 'Créer'}</button>
      </div>
    </form>`);

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('budget-form').addEventListener('submit', e => {
    e.preventDefault();
    const categoryId   = e.target.categoryId.value;
    const amount       = parseFloat(e.target.amount.value);
    const recurrence   = e.target.recurrence.value;
    const showAsExpense = e.target.showAsExpense.checked;
    if (!amount || amount <= 0) { showToast('Montant invalide.', 'error'); return; }
    const budgets = getBudgets();
    if (bud) {
      const idx = budgets.findIndex(b => b.id === bud.id);
      budgets[idx] = { ...budgets[idx], categoryId, amount, recurrence, showAsExpense };
    } else {
      budgets.push({ id: uid(), categoryId, amount, recurrence, showAsExpense });
    }
    saveBudgets(budgets);
    closeModal();
    showToast(bud ? 'Budget modifié.' : 'Budget créé.', 'success');
    renderBudgets(document.getElementById('panel-budgets'));
  });
}

function deleteBudget(id) {
  if (!confirm('Supprimer ce budget ?')) return;
  saveBudgets(getBudgets().filter(b => b.id !== id));
  showToast('Budget supprimé.', 'success');
  renderBudgets(document.getElementById('panel-budgets'));
}

// ═══════════════════════════════════════════════════════════════
//  PRÉVISIONNEL (FORECAST)
// ═══════════════════════════════════════════════════════════════

function renderForecast(panel) {
  const budgets    = getBudgets();
  const accounts   = getAccounts();
  const categories = getCategories();

  if (!panel.dataset.periodType) {
    const d = getPeriodDates('quarter');
    panel.dataset.periodType  = 'quarter';
    panel.dataset.periodStart = d.start;
    panel.dataset.periodEnd   = d.end;
  }
  const { start, end } = getPanelPeriod(panel);

  // recurring budgets = expenses
  const recurringBudgets = budgets.filter(b => b.recurrence);
  const totalRecurringExp = recurringBudgets.reduce((s, b) => s + b.amount, 0);

  // recurring incomes
  const recurringIncomes = getIncomes().filter(i => i.recurrence);
  const totalRecurringInc = recurringIncomes.reduce((s, i) => s + i.amount, 0);

  const totalBalance  = accounts.reduce((s, a) => s + a.balance, 0);
  const totalUnpaid   = getExpenses().filter(e => !e.debited).reduce((s, e) => s + e.amount, 0);
  const totalPending  = getIncomes().filter(i => !i.credited).reduce((s, i) => s + i.amount, 0);
  const net           = totalRecurringInc - totalRecurringExp;

  // Generate months in the selected period
  const months = [];
  const startDate = new Date(start + 'T00:00:00');
  const endDate   = new Date(end   + 'T00:00:00');
  let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cur <= endDate && months.length < 12) {
    months.push(cur.getFullYear() + '-' + String(cur.getMonth() + 1).padStart(2, '0'));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  panel.innerHTML = `
    ${buildPeriodBar(panel, renderForecast)}

    <div class="calc-summary">
      <div class="calc-card calc-card--orange">
        <span class="calc-card__label">Impayés</span>
        <span class="calc-card__value">${formatCurrency(totalUnpaid)}</span>
      </div>
      <div class="calc-card" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3)">
        <span class="calc-card__label">Revenus en attente</span>
        <span class="calc-card__value" style="color:var(--accent)">${formatCurrency(totalPending)}</span>
      </div>
      <div class="summary-card">
        <span class="summary-card__label">Solde actuel</span>
        <span class="summary-card__value">${formatCurrency(totalBalance)}</span>
      </div>
      <div class="summary-card summary-card--expense">
        <span class="summary-card__label">Charges récurrentes/mois</span>
        <span class="summary-card__value">${formatCurrency(totalRecurringExp)}</span>
      </div>
      <div class="summary-card summary-card--income">
        <span class="summary-card__label">Revenus récurrents/mois</span>
        <span class="summary-card__value">${formatCurrency(totalRecurringInc)}</span>
      </div>
      <div class="calc-card ${net >= 0 ? 'calc-card--green' : 'calc-card--orange'}">
        <span class="calc-card__label">Flux net mensuel</span>
        <span class="calc-card__value">${formatCurrency(net)}</span>
      </div>
    </div>

    ${months.length === 0 ? '<div class="empty-state"><p>Sélectionnez une période valide.</p></div>' : `
      <section class="section">
        <h2 class="section__title">Projections mensuelles</h2>
        <div class="forecast-grid">
          ${months.map((m, idx) => {
            const projBal = totalBalance + net * (idx + 1);
            return `
              <div class="forecast-card${projBal < 0 ? ' forecast-card--negative' : ''}">
                <h3 class="forecast-card__month">${monthLabel(m)}</h3>
                ${recurringIncomes.length > 0 ? `
                  <div class="forecast-card__section-label">Revenus</div>
                  <ul class="forecast-card__list" role="list">
                    ${recurringIncomes.map(i => {
                      const cat = categories.find(c => c.id === i.categoryId);
                      return `<li class="forecast-card__item">
                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escHtml(cat ? cat.color : '#8b5cf6')}" aria-hidden="true"></span>
                        <span>${escHtml(i.label)}</span>
                        <span class="text-success">+${formatCurrency(i.amount)}</span>
                      </li>`;
                    }).join('')}
                  </ul>` : ''}
                ${recurringBudgets.length > 0 ? `
                  <div class="forecast-card__section-label">Charges</div>
                  <ul class="forecast-card__list" role="list">
                    ${recurringBudgets.map(b => {
                      const cat = categories.find(c => c.id === b.categoryId);
                      return `<li class="forecast-card__item">
                        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escHtml(cat ? cat.color : '#64748b')}" aria-hidden="true"></span>
                        <span>${escHtml(cat ? cat.name : '—')}</span>
                        <span>${formatCurrency(b.amount)}</span>
                      </li>`;
                    }).join('')}
                  </ul>` : ''}
                <div class="forecast-card__total">
                  <span>Flux net</span>
                  <strong class="${net >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(net)}</strong>
                </div>
                <div class="forecast-card__balance">
                  <span>Solde projeté</span>
                  <strong class="${projBal < 0 ? 'text-danger' : 'text-success'}">${formatCurrency(projBal)}</strong>
                </div>
              </div>`;
          }).join('')}
        </div>
      </section>
    `}`;

  initPeriodBar(panel, renderForecast);
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════

function renderSettings(panel) {
  const settings = getSettings();
  const profile  = settings.profile || {};

  panel.innerHTML = `
    <section class="section" style="margin-top:0">
      <h2 class="section__title">Profil</h2>
      <form id="profile-form" class="form settings-form-compact">
        <div class="form-row">
          <div class="form-group">
            <label for="set-name" class="form-label">Nom d'utilisateur</label>
            <input id="set-name" name="name" type="text" class="form-input" value="${escHtml(profile.name || '')}" autocomplete="name">
          </div>
          <div class="form-group">
            <label for="set-email" class="form-label">Adresse e-mail</label>
            <input id="set-email" name="email" type="email" class="form-input" value="${escHtml(profile.email || '')}" autocomplete="email">
          </div>
        </div>
        <div class="form-group">
          <label for="set-password" class="form-label">Nouveau mot de passe</label>
          <input id="set-password" name="password" type="password" class="form-input" placeholder="Laisser vide pour ne pas modifier" autocomplete="new-password">
        </div>
        <div class="form-actions" style="justify-content:flex-start">
          <button type="submit" class="btn btn--primary">Enregistrer le profil</button>
        </div>
      </form>
    </section>

    <section class="section">
      <h2 class="section__title">Apparence</h2>
      <div class="theme-selector">
        ${THEMES.map(t => `
          <button class="theme-btn${(settings.theme || 'auto') === t ? ' theme-btn--active' : ''}" data-theme="${t}">
            ${t === 'auto' ? '🌓 Auto' : t === 'dark' ? '🌙 Sombre' : '☀️ Clair'}
          </button>`).join('')}
      </div>
    </section>

    <section class="section">
      <h2 class="section__title">Général</h2>
      <form id="settings-form" class="form settings-form-compact">
        <div class="form-group">
          <label for="set-currency" class="form-label">Devise</label>
          <select id="set-currency" name="currency" class="form-select" style="max-width:280px">
            <option value="EUR"${settings.currency === 'EUR' ? ' selected' : ''}>Euro (€)</option>
            <option value="USD"${settings.currency === 'USD' ? ' selected' : ''}>Dollar américain ($)</option>
            <option value="GBP"${settings.currency === 'GBP' ? ' selected' : ''}>Livre sterling (£)</option>
            <option value="CHF"${settings.currency === 'CHF' ? ' selected' : ''}>Franc suisse (CHF)</option>
            <option value="CAD"${settings.currency === 'CAD' ? ' selected' : ''}>Dollar canadien (CA$)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-check">
            <input type="checkbox" name="statusConfirmation"${settings.statusConfirmation ? ' checked' : ''}>
            <span>Demander confirmation avant le changement de statut</span>
          </label>
        </div>
        <div class="form-actions" style="justify-content:flex-start">
          <button type="submit" class="btn btn--primary">Enregistrer</button>
        </div>
      </form>
    </section>

    <section class="section">
      <h2 class="section__title">Export PDF</h2>
      <div class="settings-actions">
        <button class="btn btn--secondary" id="btn-pdf-expenses">📄 Dépenses</button>
        <button class="btn btn--secondary" id="btn-pdf-incomes">📄 Revenus</button>
        <button class="btn btn--secondary" id="btn-pdf-budgets">📄 Budgets</button>
        <button class="btn btn--secondary" id="btn-pdf-bilan">📄 Bilan</button>
      </div>
    </section>

    <section class="section">
      <h2 class="section__title">Données</h2>
      <div class="settings-actions">
        <button class="btn btn--secondary" id="btn-export">Exporter (JSON)</button>
        <label class="btn btn--secondary" style="cursor:pointer">
          Importer (JSON)
          <input id="import-file" type="file" accept=".json" class="sr-only">
        </label>
        <button class="btn btn--danger" id="btn-reset">Réinitialiser toutes les données</button>
      </div>
    </section>

    <section class="section">
      <h2 class="section__title">Tarifs</h2>
      <div class="pricing-grid">
        <div class="pricing-card">
          <div class="pricing-card__badge">Mensuel</div>
          <div class="pricing-card__price">2,99€<span>/mois</span></div>
          <div class="pricing-card__note">1er mois gratuit</div>
          <ul class="pricing-card__features">
            <li>Toutes les fonctionnalités</li>
            <li>Synchronisation cloud</li>
            <li>Support prioritaire</li>
          </ul>
          <button class="btn btn--primary" disabled>Choisir</button>
        </div>
        <div class="pricing-card pricing-card--featured">
          <div class="pricing-card__badge pricing-card__badge--featured">Annuel — Meilleure offre</div>
          <div class="pricing-card__price">29,99€<span>/an</span></div>
          <div class="pricing-card__note">Économisez 5,89€ · 1er mois gratuit</div>
          <ul class="pricing-card__features">
            <li>Toutes les fonctionnalités</li>
            <li>Synchronisation cloud</li>
            <li>Support prioritaire</li>
          </ul>
          <button class="btn btn--primary" disabled>Choisir</button>
        </div>
        <div class="pricing-card">
          <div class="pricing-card__badge">Achat unique</div>
          <div class="pricing-card__price">49,99€<span> une fois</span></div>
          <div class="pricing-card__note">Accès à vie</div>
          <ul class="pricing-card__features">
            <li>Toutes les fonctionnalités</li>
            <li>Mises à jour incluses</li>
            <li>Support standard</li>
          </ul>
          <button class="btn btn--primary" disabled>Choisir</button>
        </div>
      </div>
      <p class="settings-note">Les paiements ne sont pas encore disponibles dans cette version.</p>
    </section>`;

  // Profile form
  panel.querySelector('#profile-form').addEventListener('submit', e => {
    e.preventDefault();
    const name  = e.target.name.value.trim();
    const email = e.target.email.value.trim();
    const s = getSettings();
    saveSettings({ ...s, profile: { ...s.profile, name, email } });
    buildProfileMenu();
    showToast('Profil enregistré.', 'success');
  });

  // Theme buttons
  panel.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.theme;
      saveSettings({ ...getSettings(), theme: t });
      applyTheme(t);
      panel.querySelectorAll('.theme-btn').forEach(b =>
        b.classList.toggle('theme-btn--active', b.dataset.theme === t));
      const tBtn = document.querySelector('.btn--auto');
      if (tBtn) tBtn.textContent = THEME_LABELS[t] || 'Auto';
    });
  });

  // Settings form
  panel.querySelector('#settings-form').addEventListener('submit', e => {
    e.preventDefault();
    const currency = e.target.currency.value;
    const statusConfirmation = e.target.statusConfirmation.checked;
    saveSettings({ ...getSettings(), currency, statusConfirmation });
    showToast('Paramètres enregistrés.', 'success');
  });

  // PDF exports
  panel.querySelector('#btn-pdf-expenses').addEventListener('click', () => exportPDF('expenses'));
  panel.querySelector('#btn-pdf-incomes').addEventListener('click', () => exportPDF('incomes'));
  panel.querySelector('#btn-pdf-budgets').addEventListener('click', () => exportPDF('budgets'));
  panel.querySelector('#btn-pdf-bilan').addEventListener('click', () => exportPDF('bilan'));

  // JSON export
  panel.querySelector('#btn-export').addEventListener('click', () => {
    const data = {
      accounts: getAccounts(), expenses: getExpenses(),
      incomes:  getIncomes(),  categories: getCategories(),
      budgets:  getBudgets(),  settings: getSettings(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: 'finance-manager-' + todayISO() + '.json',
    });
    a.click();
    URL.revokeObjectURL(url);
    showToast('Données exportées.', 'success');
  });

  // JSON import
  panel.querySelector('#import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.accounts)   saveAccounts(data.accounts);
        if (data.expenses)   saveExpenses(data.expenses);
        if (data.incomes)    saveIncomes(data.incomes);
        if (data.categories) saveCategories(data.categories);
        if (data.budgets)    saveBudgets(data.budgets);
        if (data.settings)   saveSettings(data.settings);
        showToast('Données importées avec succès.', 'success');
        renderActivePanel();
      } catch (_) {
        showToast('Fichier JSON invalide.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Reset
  panel.querySelector('#btn-reset').addEventListener('click', () => {
    if (!confirm('Effacer toutes les données ? Cette action est irréversible.')) return;
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    seedCategories();
    showToast('Données réinitialisées.', 'success');
    renderActivePanel();
  });
}

// ═══════════════════════════════════════════════════════════════
//  PDF EXPORT
// ═══════════════════════════════════════════════════════════════

function exportPDF(type) {
  const categories = getCategories();
  const accounts   = getAccounts();
  const today      = todayISO();

  let title = '';
  let tableHTML = '';

  if (type === 'expenses') {
    title = 'Dépenses';
    const rows = getExpenses().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    tableHTML = `<table>
      <thead><tr><th>Libellé</th><th>Catégorie</th><th>Montant</th><th>Date</th><th>Compte</th><th>Récurrence</th><th>Statut</th></tr></thead>
      <tbody>${rows.map(e => {
        const cat = categories.find(c => c.id === e.categoryId);
        const acc = accounts.find(a => a.id === e.accountId);
        return `<tr>
          <td>${escHtml(e.label)}</td>
          <td>${escHtml(cat ? cat.name : '—')}</td>
          <td style="text-align:right">${formatCurrency(e.amount)}</td>
          <td>${formatDate(e.date)}</td>
          <td>${escHtml(acc ? acc.name : '—')}</td>
          <td>${escHtml(e.recurrence ? RECURRENCE_LABELS[e.recurrence] : '—')}</td>
          <td>${e.debited ? 'Payé' : 'En attente'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  } else if (type === 'incomes') {
    title = 'Revenus';
    const rows = getIncomes().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    tableHTML = `<table>
      <thead><tr><th>Libellé</th><th>Catégorie</th><th>Montant</th><th>Date</th><th>Compte</th><th>Récurrence</th><th>Statut</th></tr></thead>
      <tbody>${rows.map(i => {
        const cat = categories.find(c => c.id === i.categoryId);
        const acc = accounts.find(a => a.id === i.accountId);
        return `<tr>
          <td>${escHtml(i.label)}</td>
          <td>${escHtml(cat ? cat.name : '—')}</td>
          <td style="text-align:right;color:green">+${formatCurrency(i.amount)}</td>
          <td>${formatDate(i.date)}</td>
          <td>${escHtml(acc ? acc.name : '—')}</td>
          <td>${escHtml(i.recurrence ? RECURRENCE_LABELS[i.recurrence] : '—')}</td>
          <td>${i.credited ? 'Reçu' : 'En attente'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  } else if (type === 'budgets') {
    title = 'Budgets';
    const rows = getBudgets();
    const month = currentMonth();
    const monthExp = getExpenses().filter(e => (e.date || '').startsWith(month));
    tableHTML = `<table>
      <thead><tr><th>Catégorie</th><th>Récurrence</th><th>Budget</th><th>Dépensé</th><th>Reste</th></tr></thead>
      <tbody>${rows.map(b => {
        const cat   = categories.find(c => c.id === b.categoryId);
        const spent = monthExp.filter(e => e.categoryId === b.categoryId).reduce((s, e) => s + e.amount, 0);
        return `<tr>
          <td>${escHtml(cat ? cat.name : '—')}</td>
          <td>${escHtml(BUDGET_RECURRENCE_LABELS[b.recurrence] || '—')}</td>
          <td style="text-align:right">${formatCurrency(b.amount)}</td>
          <td style="text-align:right">${formatCurrency(spent)}</td>
          <td style="text-align:right;color:${(b.amount - spent) < 0 ? 'red' : 'green'}">${formatCurrency(b.amount - spent)}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
  } else if (type === 'bilan') {
    title = 'Bilan financier';
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const totalExp = getExpenses().reduce((s, e) => s + e.amount, 0);
    const totalInc = getIncomes().reduce((s, i) => s + i.amount, 0);
    tableHTML = `<table>
      <thead><tr><th>Compte</th><th>Solde</th></tr></thead>
      <tbody>
        ${accounts.map(a => `<tr><td>${escHtml(a.name)}</td><td style="text-align:right">${formatCurrency(a.balance)}</td></tr>`).join('')}
        <tr style="font-weight:bold;border-top:2px solid #000"><td>Total</td><td style="text-align:right">${formatCurrency(totalBalance)}</td></tr>
      </tbody>
    </table>
    <br>
    <table>
      <thead><tr><th>Indicateur</th><th>Valeur</th></tr></thead>
      <tbody>
        <tr><td>Total dépenses</td><td style="text-align:right;color:red">${formatCurrency(totalExp)}</td></tr>
        <tr><td>Total revenus</td><td style="text-align:right;color:green">${formatCurrency(totalInc)}</td></tr>
        <tr style="font-weight:bold"><td>Solde net</td><td style="text-align:right">${formatCurrency(totalInc - totalExp)}</td></tr>
      </tbody>
    </table>`;
  }

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html lang="fr"><head>
    <meta charset="UTF-8">
    <title>Finance Manager — ${escHtml(title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; }
      h1   { font-size: 1.5rem; margin-bottom: 0.5rem; }
      p    { color: #64748b; margin-bottom: 1.5rem; font-size: 0.875rem; }
      table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
      th   { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 2px solid #1e293b; }
      td   { padding: 0.4rem 0.75rem; border-bottom: 1px solid #e2e8f0; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>
    <h1>${escHtml(title)}</h1>
    <p>Généré le ${formatDate(today)} — Finance Manager</p>
    ${tableHTML}
    <script>window.print();<\/script>
  </body></html>`);
  w.document.close();
}

// ═══════════════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════════════

function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const overlay = document.getElementById('modal-overlay');
  overlay.hidden = false;
  overlay.removeAttribute('aria-hidden');
  setTimeout(() => {
    const first = document.getElementById('modal-body')
      .querySelector('input:not([type=hidden]), select, textarea');
    if (first) first.focus();
    else document.getElementById('modal-close').focus();
  }, 50);
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
}

// ═══════════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════════

let toastTimer = null;

function showToast(message, type) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast toast--' + (type || 'success') + ' toast--visible';
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => { toast.hidden = true; }, 300);
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════════

function init() {
  seedCategories();

  // Apply saved theme
  const settings = getSettings();
  applyTheme(settings.theme || 'auto');

  buildTabNav();

  // Build panel containers
  const main = document.getElementById('app-main');
  main.innerHTML = TABS.map(t => `
    <section
      id="panel-${t.id}"
      class="tab-panel"
      role="tabpanel"
      ${t.id !== activeTab ? 'hidden aria-hidden="true"' : ''}
    ></section>`).join('');

  renderActivePanel();

  // Header: display today's date
  const dateEl = document.getElementById('header-date');
  if (dateEl) {
    dateEl.textContent = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }).format(new Date());
  }

  // Theme button
  const themeBtn = document.querySelector('.btn--auto');
  if (themeBtn) {
    themeBtn.textContent = THEME_LABELS[settings.theme || 'auto'] || 'Auto';
    themeBtn.addEventListener('click', cycleTheme);
  }

  // Profile menu
  buildProfileMenu();

  // Sidebar toggle (mobile)
  const sidebarToggle  = document.getElementById('sidebar-toggle');
  const sidebar        = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', () => {
      const open = sidebar.classList.toggle('sidebar--open');
      sidebarToggle.setAttribute('aria-expanded', String(open));
      if (sidebarOverlay) {
        sidebarOverlay.hidden = !open;
        sidebarOverlay.setAttribute('aria-hidden', String(!open));
      }
    });
  }

  if (sidebarOverlay && sidebar) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('sidebar--open');
      if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
      sidebarOverlay.hidden = true;
      sidebarOverlay.setAttribute('aria-hidden', 'true');
    });
  }

  // Modal: close on backdrop click
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Modal: close button
  document.getElementById('modal-close').addEventListener('click', closeModal);

  // Modal: close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('modal-overlay');
      if (!overlay.hidden) closeModal();
      const menu = document.getElementById('profile-menu');
      if (menu) { menu.remove(); document.querySelector('.user-avatar')?.setAttribute('aria-expanded', 'false'); }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
