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
function getSettings()   { return load(KEYS.settings,   { currency: 'EUR' }); }

function saveAccounts(d)   { save(KEYS.accounts,   d); }
function saveExpenses(d)   { save(KEYS.expenses,   d); }
function saveIncomes(d)    { save(KEYS.incomes,    d); }
function saveCategories(d) { save(KEYS.categories, d); }
function saveBudgets(d)    { save(KEYS.budgets,    d); }
function saveSettings(d)   { save(KEYS.settings,   d); }

function seedCategories() {
  if (getCategories().length === 0) {
    saveCategories([
      { id: uid(), name: 'Alimentation', color: '#22c55e' },
      { id: uid(), name: 'Transport',    color: '#3b82f6' },
      { id: uid(), name: 'Logement',     color: '#f59e0b' },
      { id: uid(), name: 'Loisirs',      color: '#ec4899' },
      { id: uid(), name: 'Santé',        color: '#14b8a6' },
      { id: uid(), name: 'Salaire',      color: '#8b5cf6' },
      { id: uid(), name: 'Autre',        color: '#64748b' },
    ]);
  }
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
  { id: 'accounts',   label: 'Comptes',          icon: iconAccounts   },
  { id: 'expenses',   label: 'Dépenses',         icon: iconExpenses   },
  { id: 'incomes',    label: 'Revenus',          icon: iconIncomes    },
  { id: 'categories', label: 'Catégories',       icon: iconCategories },
  { id: 'budgets',    label: 'Budgets',          icon: iconBudgets    },
  { id: 'forecast',   label: 'Prévisionnel',     icon: iconForecast   },
  { id: 'settings',   label: 'Paramètres',       icon: iconSettings   },
];

function buildTabNav() {
  const nav = document.getElementById('tab-nav');
  nav.innerHTML = TABS.map(t => `
    <button
      class="tab-btn${t.id === activeTab ? ' tab-btn--active' : ''}"
      role="tab"
      aria-selected="${t.id === activeTab}"
      aria-controls="panel-${t.id}"
      id="tab-${t.id}"
      data-tab="${t.id}"
    >${t.icon()}<span class="tab-btn__label">${escHtml(t.label)}</span></button>
  `).join('');

  nav.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const active = btn.dataset.tab === tabId;
    btn.classList.toggle('tab-btn--active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  // Scroll active tab into view
  const activeBtn = document.getElementById('tab-' + tabId);
  if (activeBtn) activeBtn.scrollIntoView({ inline: 'nearest', block: 'nearest' });
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
    case 'incomes':    renderIncomes(panel);    break;
    case 'categories': renderCategories(panel); break;
    case 'budgets':    renderBudgets(panel);    break;
    case 'forecast':   renderForecast(panel);   break;
    case 'settings':   renderSettings(panel);   break;
  }
}

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════

function renderDashboard(panel) {
  const accounts   = getAccounts();
  const expenses   = getExpenses();
  const incomes    = getIncomes();
  const categories = getCategories();

  const totalBalance      = accounts.reduce((s, a) => s + a.balance, 0);
  const month             = currentMonth();
  const monthExpenses     = expenses.filter(e => (e.date || '').startsWith(month));
  const monthIncomes      = incomes.filter(i  => (i.date || '').startsWith(month));
  const totalMonthExp     = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const totalMonthInc     = monthIncomes.reduce((s, i)  => s + i.amount, 0);

  // Expenses by category this month
  const expByCat = {};
  monthExpenses.forEach(e => {
    if (e.categoryId) expByCat[e.categoryId] = (expByCat[e.categoryId] || 0) + e.amount;
  });

  // Recent transactions (last 5)
  const allTx = [
    ...expenses.map(e => ({ ...e, type: 'expense' })),
    ...incomes.map(i  => ({ ...i, type: 'income'  })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);

  panel.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Tableau de bord</h1>
        <p class="page-subtitle">${monthLabel(month)}</p>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card summary-card--balance">
        <span class="summary-card__label">Solde total</span>
        <span class="summary-card__value">${formatCurrency(totalBalance)}</span>
      </div>
      <div class="summary-card summary-card--expense">
        <span class="summary-card__label">Dépenses du mois</span>
        <span class="summary-card__value">${formatCurrency(totalMonthExp)}</span>
      </div>
      <div class="summary-card summary-card--income">
        <span class="summary-card__label">Revenus du mois</span>
        <span class="summary-card__value">${formatCurrency(totalMonthInc)}</span>
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
        ? '<div class="empty-state"><p>Aucune transaction. Commencez par créer un compte,<br>puis saisissez vos dépenses et revenus.</p></div>'
        : `<ul class="tx-list" role="list">
            ${allTx.map(tx => {
              const cat = categories.find(c => c.id === tx.categoryId);
              const acc = accounts.find(a => a.id === tx.accountId);
              return `
                <li class="tx-item">
                  <span class="tx-item__dot" style="background:${escHtml(cat ? cat.color : '#64748b')}" aria-hidden="true"></span>
                  <span class="tx-item__label">${escHtml(tx.label)}</span>
                  <span class="tx-item__meta">${escHtml(acc ? acc.name : '—')} · ${formatDate(tx.date)}</span>
                  <span class="tx-item__amount tx-item__amount--${tx.type}">
                    ${tx.type === 'expense' ? '−' : '+'}${formatCurrency(tx.amount)}
                  </span>
                </li>`;
            }).join('')}
          </ul>`
      }
    </section>
  `;
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
      <text x="${labelW - 8}" y="${midY + 5}" text-anchor="end" font-size="13" fill="#64748b" font-family="system-ui,sans-serif">${escHtml(name)}</text>
      <rect x="${labelW}" y="${y}" width="${barW}" height="${rowH}" rx="5" fill="${escHtml(color)}" opacity="0.85"/>
      <text x="${labelW + barW + 8}" y="${midY + 5}" font-size="13" fill="#1e293b" font-family="system-ui,sans-serif" font-weight="600">${formatCurrency(val)}</text>`;
  }).join('');

  return `
    <div class="chart-wrapper" role="img" aria-label="Graphique des dépenses par catégorie du mois">
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
      <h1 class="page-title">Comptes</h1>
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
  const filterMonth = panel.dataset.filterMonth || currentMonth();

  const filtered = getExpenses()
    .filter(e => (e.date || '').startsWith(filterMonth))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Dépenses</h1>
      <button class="btn btn--primary btn--sm" id="btn-add-expense">+ Ajouter</button>
    </div>
    <div class="filter-bar">
      <label for="expense-month" class="sr-only">Filtrer par mois</label>
      <input id="expense-month" type="month" class="form-input form-input--month" value="${escHtml(filterMonth)}" aria-label="Filtrer par mois">
    </div>
    ${filtered.length === 0
      ? '<div class="empty-state"><p>Aucune dépense pour ce mois.</p></div>'
      : `<ul class="item-list" role="list">
          ${filtered.map(exp => {
            const acc = accounts.find(a => a.id === exp.accountId);
            const cat = categories.find(c => c.id === exp.categoryId);
            return `
              <li class="item-card">
                <span class="item-card__dot" style="background:${escHtml(cat ? cat.color : '#64748b')}" aria-hidden="true"></span>
                <div class="item-card__info">
                  <span class="item-card__name">${escHtml(exp.label)}</span>
                  <span class="item-card__meta">
                    ${escHtml(cat ? cat.name : '—')} · ${escHtml(acc ? acc.name : '—')} · ${formatDate(exp.date)}
                    ${exp.debited ? '<span class="badge badge--debited">Débité</span>' : ''}
                  </span>
                </div>
                <span class="item-card__amount item-card__amount--expense">${formatCurrency(exp.amount)}</span>
                <div class="item-card__actions">
                  ${!exp.debited
                    ? `<button class="btn btn--debit btn--sm" data-id="${escHtml(exp.id)}" aria-label="Débiter ${escHtml(exp.label)}">Débiter</button>`
                    : ''}
                  <button class="btn-icon btn-icon--edit" data-id="${escHtml(exp.id)}" aria-label="Modifier">${iconEdit()}</button>
                  <button class="btn-icon btn-icon--delete" data-id="${escHtml(exp.id)}" aria-label="Supprimer">${iconDelete()}</button>
                </div>
              </li>`;
          }).join('')}
        </ul>`
    }`;

  panel.dataset.filterMonth = filterMonth;
  panel.querySelector('#btn-add-expense').addEventListener('click', () => openExpenseForm());
  panel.querySelector('#expense-month').addEventListener('change', e => {
    panel.dataset.filterMonth = e.target.value;
    renderExpenses(panel);
  });
  panel.querySelectorAll('.btn--debit').forEach(btn =>
    btn.addEventListener('click', () => debitExpense(btn.dataset.id)));
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
            ${categories.map(c => `<option value="${escHtml(c.id)}"${exp && exp.categoryId === c.id ? ' selected' : ''}>${escHtml(c.name)}</option>`).join('')}
          </select>
        </div>
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
    if (!label)              { showToast('Le libellé est requis.', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Montant invalide.', 'error'); return; }
    const expenses = getExpenses();
    if (exp) {
      const idx = expenses.findIndex(e => e.id === exp.id);
      expenses[idx] = { ...expenses[idx], label, amount, date, accountId, categoryId };
    } else {
      expenses.push({ id: uid(), label, amount, date, accountId, categoryId, debited: false });
    }
    saveExpenses(expenses);
    closeModal();
    showToast(exp ? 'Dépense modifiée.' : 'Dépense ajoutée.', 'success');
    renderExpenses(document.getElementById('panel-expenses'));
  });
}

function debitExpense(id) {
  const expenses = getExpenses();
  const accounts = getAccounts();
  const exp = expenses.find(e => e.id === id);
  if (!exp) return;
  const acc = accounts.find(a => a.id === exp.accountId);
  if (!acc) { showToast('Compte introuvable.', 'error'); return; }
  acc.balance -= exp.amount;
  exp.debited = true;
  saveExpenses(expenses);
  saveAccounts(accounts);
  showToast(formatCurrency(exp.amount) + ' débité de « ' + acc.name + ' ».', 'success');
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
  const filterMonth = panel.dataset.filterMonth || currentMonth();

  const filtered = getIncomes()
    .filter(i => (i.date || '').startsWith(filterMonth))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Revenus</h1>
      <button class="btn btn--primary btn--sm" id="btn-add-income">+ Ajouter</button>
    </div>
    <div class="filter-bar">
      <label for="income-month" class="sr-only">Filtrer par mois</label>
      <input id="income-month" type="month" class="form-input form-input--month" value="${escHtml(filterMonth)}" aria-label="Filtrer par mois">
    </div>
    ${filtered.length === 0
      ? '<div class="empty-state"><p>Aucun revenu pour ce mois.</p></div>'
      : `<ul class="item-list" role="list">
          ${filtered.map(inc => {
            const acc = accounts.find(a => a.id === inc.accountId);
            const cat = categories.find(c => c.id === inc.categoryId);
            return `
              <li class="item-card">
                <span class="item-card__dot" style="background:${escHtml(cat ? cat.color : '#64748b')}" aria-hidden="true"></span>
                <div class="item-card__info">
                  <span class="item-card__name">${escHtml(inc.label)}</span>
                  <span class="item-card__meta">
                    ${escHtml(cat ? cat.name : '—')} · ${escHtml(acc ? acc.name : '—')} · ${formatDate(inc.date)}
                    ${inc.credited ? '<span class="badge badge--credited">Crédité</span>' : ''}
                  </span>
                </div>
                <span class="item-card__amount item-card__amount--income">+${formatCurrency(inc.amount)}</span>
                <div class="item-card__actions">
                  ${!inc.credited
                    ? `<button class="btn btn--credit btn--sm" data-id="${escHtml(inc.id)}" aria-label="Créditer ${escHtml(inc.label)}">Créditer</button>`
                    : ''}
                  <button class="btn-icon btn-icon--edit" data-id="${escHtml(inc.id)}" aria-label="Modifier">${iconEdit()}</button>
                  <button class="btn-icon btn-icon--delete" data-id="${escHtml(inc.id)}" aria-label="Supprimer">${iconDelete()}</button>
                </div>
              </li>`;
          }).join('')}
        </ul>`
    }`;

  panel.dataset.filterMonth = filterMonth;
  panel.querySelector('#btn-add-income').addEventListener('click', () => openIncomeForm());
  panel.querySelector('#income-month').addEventListener('change', e => {
    panel.dataset.filterMonth = e.target.value;
    renderIncomes(panel);
  });
  panel.querySelectorAll('.btn--credit').forEach(btn =>
    btn.addEventListener('click', () => creditIncome(btn.dataset.id)));
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
            ${categories.map(c => `<option value="${escHtml(c.id)}"${inc && inc.categoryId === c.id ? ' selected' : ''}>${escHtml(c.name)}</option>`).join('')}
          </select>
        </div>
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
    if (!label)              { showToast('Le libellé est requis.', 'error'); return; }
    if (!amount || amount <= 0) { showToast('Montant invalide.', 'error'); return; }
    const incomes = getIncomes();
    if (inc) {
      const idx = incomes.findIndex(i => i.id === inc.id);
      incomes[idx] = { ...incomes[idx], label, amount, date, accountId, categoryId };
    } else {
      incomes.push({ id: uid(), label, amount, date, accountId, categoryId, credited: false });
    }
    saveIncomes(incomes);
    closeModal();
    showToast(inc ? 'Revenu modifié.' : 'Revenu ajouté.', 'success');
    renderIncomes(document.getElementById('panel-incomes'));
  });
}

function creditIncome(id) {
  const incomes  = getIncomes();
  const accounts = getAccounts();
  const inc = incomes.find(i => i.id === id);
  if (!inc) return;
  const acc = accounts.find(a => a.id === inc.accountId);
  if (!acc) { showToast('Compte introuvable.', 'error'); return; }
  acc.balance += inc.amount;
  inc.credited = true;
  saveIncomes(incomes);
  saveAccounts(accounts);
  showToast(formatCurrency(inc.amount) + ' crédité sur « ' + acc.name + ' ».', 'success');
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
  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Catégories</h1>
      <button class="btn btn--primary btn--sm" id="btn-add-cat">+ Ajouter</button>
    </div>
    ${categories.length === 0
      ? '<div class="empty-state"><p>Aucune catégorie.</p></div>'
      : `<ul class="item-list" role="list">
          ${categories.map(cat => `
            <li class="item-card">
              <span class="item-card__dot" style="background:${escHtml(cat.color)}" aria-hidden="true"></span>
              <div class="item-card__info">
                <span class="item-card__name">${escHtml(cat.name)}</span>
              </div>
              <div class="item-card__actions">
                <button class="btn-icon btn-icon--edit" data-id="${escHtml(cat.id)}" aria-label="Modifier ${escHtml(cat.name)}">${iconEdit()}</button>
                <button class="btn-icon btn-icon--delete" data-id="${escHtml(cat.id)}" aria-label="Supprimer ${escHtml(cat.name)}">${iconDelete()}</button>
              </div>
            </li>`).join('')}
        </ul>`
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
        <label for="cat-color" class="form-label">Couleur</label>
        <input id="cat-color" name="color" type="color" class="form-input form-input--color" value="${cat ? cat.color : '#3b82f6'}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="modal-cancel">Annuler</button>
        <button type="submit" class="btn btn--primary">${cat ? 'Modifier' : 'Créer'}</button>
      </div>
    </form>`);

  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('cat-form').addEventListener('submit', e => {
    e.preventDefault();
    const name  = e.target.name.value.trim();
    const color = e.target.color.value;
    if (!name) { showToast('Le nom est requis.', 'error'); return; }
    const categories = getCategories();
    if (cat) {
      const idx = categories.findIndex(c => c.id === cat.id);
      categories[idx] = { ...categories[idx], name, color };
    } else {
      categories.push({ id: uid(), name, color });
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

function renderBudgets(panel) {
  const budgets    = getBudgets();
  const categories = getCategories();

  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Budgets</h1>
      <button class="btn btn--primary btn--sm" id="btn-add-budget">+ Ajouter</button>
    </div>
    ${budgets.length === 0
      ? '<div class="empty-state"><p>Aucun budget défini. Créez des budgets par catégorie.</p></div>'
      : `<ul class="item-list" role="list">
          ${budgets.map(bud => {
            const cat = categories.find(c => c.id === bud.categoryId);
            return `
              <li class="item-card">
                <span class="item-card__dot" style="background:${escHtml(cat ? cat.color : '#64748b')}" aria-hidden="true"></span>
                <div class="item-card__info">
                  <span class="item-card__name">${escHtml(cat ? cat.name : '—')}</span>
                  <span class="item-card__meta">
                    ${bud.recurring ? '<span class="badge badge--recurring">Récurrent mensuel</span>' : 'Budget ponctuel'}
                  </span>
                </div>
                <span class="item-card__amount">${formatCurrency(bud.amount)}</span>
                <div class="item-card__actions">
                  <button class="btn-icon btn-icon--edit" data-id="${escHtml(bud.id)}" aria-label="Modifier le budget">${iconEdit()}</button>
                  <button class="btn-icon btn-icon--delete" data-id="${escHtml(bud.id)}" aria-label="Supprimer le budget">${iconDelete()}</button>
                </div>
              </li>`;
          }).join('')}
        </ul>`
    }`;

  panel.querySelector('#btn-add-budget').addEventListener('click', () => openBudgetForm());
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
        <label for="bud-amount" class="form-label">Montant mensuel *</label>
        <input id="bud-amount" name="amount" type="number" step="0.01" min="0.01" class="form-input" value="${bud ? bud.amount : ''}">
      </div>
      <div class="form-group">
        <label class="form-check">
          <input type="checkbox" name="recurring"${bud && bud.recurring ? ' checked' : ''}>
          <span>Récurrent mensuel (apparaît dans le Prévisionnel)</span>
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
    const categoryId = e.target.categoryId.value;
    const amount     = parseFloat(e.target.amount.value);
    const recurring  = e.target.recurring.checked;
    if (!amount || amount <= 0) { showToast('Montant invalide.', 'error'); return; }
    const budgets = getBudgets();
    if (bud) {
      const idx = budgets.findIndex(b => b.id === bud.id);
      budgets[idx] = { ...budgets[idx], categoryId, amount, recurring };
    } else {
      budgets.push({ id: uid(), categoryId, amount, recurring });
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

  const recurring      = budgets.filter(b => b.recurring);
  const totalRecurring = recurring.reduce((s, b) => s + b.amount, 0);
  const totalBalance   = accounts.reduce((s, a) => s + a.balance, 0);
  const month          = currentMonth();

  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Prévisionnel</h1>
    </div>

    ${recurring.length === 0 ? `
      <div class="empty-state">
        <p>Aucun budget récurrent.<br>
        Créez des budgets avec l'option <strong>Récurrent mensuel</strong> pour visualiser vos projections.</p>
      </div>
    ` : `
      <div class="summary-grid">
        <div class="summary-card">
          <span class="summary-card__label">Solde actuel</span>
          <span class="summary-card__value">${formatCurrency(totalBalance)}</span>
        </div>
        <div class="summary-card summary-card--expense">
          <span class="summary-card__label">Charges mensuelles</span>
          <span class="summary-card__value">${formatCurrency(totalRecurring)}</span>
        </div>
      </div>

      <section class="section">
        <h2 class="section__title">Projections — 3 mois à venir</h2>
        <div class="forecast-grid">
          ${[1, 2, 3].map(n => {
            const m            = addMonths(month, n);
            const projBalance  = totalBalance - totalRecurring * n;
            return `
              <div class="forecast-card${projBalance < 0 ? ' forecast-card--negative' : ''}">
                <h3 class="forecast-card__month">${monthLabel(m)}</h3>
                <ul class="forecast-card__list" role="list">
                  ${recurring.map(b => {
                    const cat = categories.find(c => c.id === b.categoryId);
                    return `
                      <li class="forecast-card__item">
                        <span class="item-card__dot" style="background:${escHtml(cat ? cat.color : '#64748b')}" aria-hidden="true"></span>
                        <span>${escHtml(cat ? cat.name : '—')}</span>
                        <span>${formatCurrency(b.amount)}</span>
                      </li>`;
                  }).join('')}
                </ul>
                <div class="forecast-card__total">
                  <span>Total charges</span>
                  <strong>${formatCurrency(totalRecurring)}</strong>
                </div>
                <div class="forecast-card__balance">
                  <span>Solde projeté</span>
                  <strong class="${projBalance < 0 ? 'text-danger' : 'text-success'}">${formatCurrency(projBalance)}</strong>
                </div>
              </div>`;
          }).join('')}
        </div>
      </section>
    `}`;
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════

function renderSettings(panel) {
  const settings = getSettings();
  panel.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Paramètres</h1>
    </div>

    <section class="section">
      <h2 class="section__title">Général</h2>
      <form id="settings-form" class="form">
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
        <div class="form-actions" style="justify-content:flex-start">
          <button type="submit" class="btn btn--primary">Enregistrer</button>
        </div>
      </form>
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
    </section>`;

  panel.querySelector('#settings-form').addEventListener('submit', e => {
    e.preventDefault();
    saveSettings({ ...getSettings(), currency: e.target.currency.value });
    showToast('Paramètres enregistrés.', 'success');
  });

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

  panel.querySelector('#btn-reset').addEventListener('click', () => {
    if (!confirm('Effacer toutes les données ? Cette action est irréversible.')) return;
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    seedCategories();
    showToast('Données réinitialisées.', 'success');
    renderActivePanel();
  });
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
  // Focus first interactive element in the body
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
  buildTabNav();

  // Build panel containers
  const main = document.getElementById('app-main');
  main.innerHTML = TABS.map(t => `
    <section
      id="panel-${t.id}"
      class="tab-panel"
      role="tabpanel"
      aria-labelledby="tab-${t.id}"
      ${t.id !== activeTab ? 'hidden aria-hidden="true"' : ''}
    ></section>`).join('');

  renderActivePanel();

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
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
