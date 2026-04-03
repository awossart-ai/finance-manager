/* ============================================================
   Finance Manager — main.js
   Navigation mobile, interactions UI
   ============================================================ */

(function () {
  'use strict';

  /* ── Année du footer ─────────────────────────────────────── */
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ── Menu mobile ─────────────────────────────────────────── */
  const toggle = document.querySelector('.nav-toggle');
  const nav    = document.getElementById('main-nav');

  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      const expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      nav.classList.toggle('is-open', !expanded);
      this.setAttribute('aria-label', expanded ? 'Ouvrir le menu' : 'Fermer le menu');
    });

    /* Fermer le menu en cliquant sur un lien */
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    /* Fermer le menu en cliquant en dehors */
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) {
        closeMenu();
      }
    });

    /* Reset au redimensionnement desktop */
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) closeMenu();
    });

    function closeMenu() {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Ouvrir le menu');
      nav.classList.remove('is-open');
    }
  }

  /* ── Tabs (page connexion) ───────────────────────────────── */
  const authTabs = document.querySelectorAll('.auth-tab');
  if (authTabs.length) {
    authTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        authTabs.forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');

        const target = this.dataset.tab;
        document.querySelectorAll('.auth-panel').forEach(function (panel) {
          panel.classList.toggle('hidden', panel.id !== target);
        });
      });
    });
  }

  /* ── Formulaire connexion ────────────────────────────────── */
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      window.location.href = '../pages/dashboard.html';
    });
  }

  /* ── Formulaire inscription ──────────────────────────────── */
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      window.location.href = '../pages/dashboard.html';
    });
  }

  /* ── Formulaire ajout dépense ────────────────────────────── */
  const expenseForm = document.getElementById('expense-form');
  if (expenseForm) {
    expenseForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const desc    = document.getElementById('exp-desc').value.trim();
      const amount  = parseFloat(document.getElementById('exp-amount').value);
      const cat     = document.getElementById('exp-cat').value;
      const dateVal = document.getElementById('exp-date').value;

      if (!desc || isNaN(amount) || !cat || !dateVal) return;

      addExpenseRow(desc, amount, cat, dateVal);
      expenseForm.reset();
      document.getElementById('exp-date').value = new Date().toISOString().split('T')[0];
    });
  }

  function addExpenseRow(desc, amount, cat, dateVal) {
    const tbody = document.getElementById('expenses-tbody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    const d  = new Date(dateVal);
    const formatted = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    tr.innerHTML = `
      <td>${formatted}</td>
      <td>${escHtml(desc)}</td>
      <td><span class="badge badge-info">${escHtml(cat)}</span></td>
      <td class="negative" style="color:var(--color-danger);font-weight:700;">-${amount.toFixed(2)} €</td>
      <td><button class="btn btn-ghost" style="padding:.25rem .625rem;font-size:.8125rem;" onclick="this.closest('tr').remove()">Supprimer</button></td>
    `;
    tbody.prepend(tr);
  }

  /* ── Formulaire ajout budget ─────────────────────────────── */
  const budgetForm = document.getElementById('budget-form');
  if (budgetForm) {
    budgetForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const cat    = document.getElementById('bud-cat').value.trim();
      const budget = parseFloat(document.getElementById('bud-amount').value);
      const spent  = parseFloat(document.getElementById('bud-spent').value) || 0;

      if (!cat || isNaN(budget)) return;

      addBudgetRow(cat, budget, spent);
      budgetForm.reset();
    });
  }

  function addBudgetRow(cat, budget, spent) {
    const tbody = document.getElementById('budget-tbody');
    if (!tbody) return;
    const pct      = Math.min(100, Math.round((spent / budget) * 100));
    const barClass = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green';
    const rest     = budget - spent;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escHtml(cat)}</strong></td>
      <td>${budget.toFixed(2)} €</td>
      <td>${spent.toFixed(2)} €</td>
      <td style="color:${rest < 0 ? 'var(--color-danger)' : 'var(--color-success)'};font-weight:700;">${rest.toFixed(2)} €</td>
      <td style="min-width:120px;">
        <div class="progress-bar"><div class="progress-bar-fill ${barClass}" style="width:${pct}%"></div></div>
        <small style="color:var(--color-text-muted)">${pct}%</small>
      </td>
      <td><button class="btn btn-ghost" style="padding:.25rem .625rem;font-size:.8125rem;" onclick="this.closest('tr').remove()">Supprimer</button></td>
    `;
    tbody.prepend(tr);
  }

  function escHtml(str) {
    return str.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

})();
