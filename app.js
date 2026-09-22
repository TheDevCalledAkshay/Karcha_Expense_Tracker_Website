/* Karcha — local-first expense tracker */
(function () {
  'use strict';

  const STORAGE_KEY = 'karcha.expenses';
  const THEME_KEY = 'karcha.theme';

  const CATEGORIES = {
    'Food & Dining': '🍽️',
    'Groceries': '🛒',
    'Transport': '🚗',
    'Travel': '✈️',
    'Shopping': '🛍️',
    'Bills & Utilities': '💡',
    'Rent': '🏠',
    'Medical': '🩺',
    'Education': '📚',
    'Entertainment': '🎬',
    'Stocks & Shares': '📈',
    'Salary': '💼',
    'Allowance': '💵',
    'Business': '🏷️',
    'Other': '📦'
  };
  const DEFAULT_CATEGORY = { expense: 'Food & Dining', income: 'Salary' };

  const CURRENCIES = ['₹', '$', '€', '£', '¥'];
  let currency = '₹';
  try {
    const savedCurrency = localStorage.getItem('karcha.currency');
    if (CURRENCIES.includes(savedCurrency)) currency = savedCurrency;
  } catch {}

  const form = document.getElementById('expense-form');
  const listEl = document.getElementById('expense-list');
  const emptyEl = document.getElementById('empty-state');
  const clearBtn = document.getElementById('clear-all');
  const dateInput = document.getElementById('date');

  let expenses = load();
  let editingId = null;
  let currentType = 'expense';
  let currentPeriod = 'month';

  let currentCategory = DEFAULT_CATEGORY.expense;

  const catBtn = document.getElementById('cat-select');
  const catBtnLabel = document.getElementById('cat-select-label');
  const catPop = document.getElementById('cat-pop');
  const formTitle = document.getElementById('form-title');
  const submitLabel = document.getElementById('submit-label');
  const typeToggle = document.getElementById('type-toggle');

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      // migrate older entries: drop notes, default category/type
      return arr.map((e) => {
        const { note, ...rest } = e;
        const cat = CATEGORIES[rest.category] ? rest.category : 'Other';
        return { type: 'expense', category: cat, ...rest, category: cat };
      });
    } catch {
      return [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }

  function formatMoney(n) {
    const locale = currency === '₹' ? 'en-IN' : 'en-US';
    const body = Math.abs(n).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '−' : '') + currency + body;
  }

  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    const day = d.toLocaleString('en', { day: 'numeric' });
    const mon = d.toLocaleString('en', { month: 'short' });
    return { day, mon };
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* ---------- Actions ---------- */

  function addExpense(desc, amount, date, type, category) {
    expenses.push({ id: uid(), desc, amount, date, type, category });
    expenses.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    save();
    render();
  }

  function updateExpense(id, desc, amount, date, type, category) {
    const e = expenses.find((x) => x.id === id);
    if (!e) return;
    Object.assign(e, { desc, amount, date, type, category });
    expenses.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    save();
    cancelEdit();
    render();
  }

  function deleteExpense(id) {
    expenses = expenses.filter((x) => x.id !== id);
    if (editingId === id) cancelEdit();
    save();
    render();
  }

  function startEdit(id) {
    editingId = id;
    const e = expenses.find((x) => x.id === id);
    if (!e) return;
    setType(e.type || 'expense');
    document.getElementById('description').value = e.desc;
    document.getElementById('amount').value = e.amount;
    setCategory(CATEGORIES[e.category] ? e.category : 'Other');
    dateInput.value = e.date;
    submitLabel.textContent = 'Update ' + (e.type === 'income' ? 'Income' : 'Expense');
    formTitle.textContent = 'Edit ' + (e.type === 'income' ? 'Income' : 'Expense');
    document.getElementById('description').focus();
  }

  function cancelEdit() {
    editingId = null;
    setType('expense');
    form.reset();
    setCategory(DEFAULT_CATEGORY.expense);
    dateInput.value = todayISO();
    submitLabel.textContent = 'Add Expense';
    formTitle.textContent = 'Add Expense';
  }

  function setType(type) {
    currentType = type;
    typeToggle.querySelectorAll('.type-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    // swap to the sensible default category for this type
    const other = type === 'income' ? 'expense' : 'income';
    if (!currentCategory || currentCategory === DEFAULT_CATEGORY[other]) {
      setCategory(DEFAULT_CATEGORY[type]);
    }
  }

  function clearAll() {
    if (expenses.length === 0) return;
    if (!confirm('Delete all ' + expenses.length + ' expenses? This cannot be undone.')) return;
    expenses = [];
    save();
    render();
  }

  /* ---------- Rendering ---------- */

  function render() {
    // period stats — dropdown decides the window
    const now = new Date();
    const monthStart = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
    const yearStart = now.getFullYear() + '-01-01';
    const since = currentPeriod === 'month' ? monthStart : currentPeriod === 'year' ? yearStart : null;

    const sum = (fn) => expenses.filter(fn).reduce((s, e) => s + e.amount, 0);
    const inPeriod = (e) => !since || e.date >= since;
    const spend = sum((e) => inPeriod(e) && e.type !== 'income');
    const earned = sum((e) => inPeriod(e) && e.type === 'income');
    const balance = earned - spend;

    document.getElementById('stat-spend').textContent = formatMoney(spend);
    document.getElementById('stat-income').textContent = formatMoney(earned);
    document.getElementById('stat-balance').textContent = formatMoney(balance);

    // list
    listEl.innerHTML = '';
    emptyEl.style.display = expenses.length ? 'none' : 'block';

    for (const e of expenses) {
      const li = document.createElement('li');
      li.className = 'expense-item';

      const { day, mon } = formatDate(e.date);

      const isToday = e.date === todayISO();
      const rel = isToday
        ? 'Today'
        : e.date === isoOffset(-1)
        ? 'Yesterday'
        : new Date(e.date + 'T00:00:00').toLocaleDateString('en', { weekday: 'long' });

      const isIncome = e.type === 'income';
      const sign = isIncome ? '+' : '−';
      const cat = CATEGORIES[e.category] ? e.category : 'Other';

      li.innerHTML =
        '<div class="expense-date">' + day + '<br>' + mon + '</div>' +
        '<div class="expense-info">' +
          '<div class="expense-desc"></div>' +
          '<div class="expense-meta">' + rel + ' · ' + (isIncome ? 'Income' : 'Expense') + '</div>' +
          '<div class="expense-cat">' + CATEGORIES[cat] + ' <span class="cat-name"></span></div>' +
        '</div>' +
        '<div class="expense-amount ' + (isIncome ? 'income' : 'expense') + '">' + sign + formatMoney(e.amount) + '</div>' +
        '<div class="expense-actions">' +
          '<button class="icon-btn" data-action="edit" title="Edit" aria-label="Edit">✏️</button>' +
          '<button class="icon-btn delete" data-action="delete" title="Delete" aria-label="Delete">🗑️</button>' +
        '</div>';

      li.querySelector('.expense-desc').textContent = e.desc;
      li.querySelector('.cat-name').textContent = cat;

      li.querySelector('[data-action="edit"]').addEventListener('click', () => startEdit(e.id));
      li.querySelector('[data-action="delete"]').addEventListener('click', () => deleteExpense(e.id));

      listEl.appendChild(li);
    }

    renderAnalytics();
  }

  function signed(e) {
    return e.type === 'income' ? e.amount : -e.amount;
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function isoOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------- Events ---------- */

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const desc = document.getElementById('description').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const category = currentCategory;
    const date = dateInput.value;
    if (!desc || !amount || amount <= 0 || !date) return;

    if (editingId) {
      updateExpense(editingId, desc, amount, date, currentType, category);
    } else {
      addExpense(desc, amount, date, currentType, category);
    }
    cancelEdit();
  });

  typeToggle.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.type-btn');
    if (btn) setType(btn.dataset.type);
  });

  const periodSelect = document.getElementById('period-select');
  const anPeriodSelect = document.getElementById('an-period');

  function setPeriod(p) {
    currentPeriod = p;
    periodSelect.value = p;
    anPeriodSelect.value = p;
    render();
  }

  periodSelect.addEventListener('change', (ev) => setPeriod(ev.target.value));
  anPeriodSelect.addEventListener('change', (ev) => setPeriod(ev.target.value));

  clearBtn.addEventListener('click', clearAll);

  /* ---------- Category picker ---------- */

  function setCategory(name) {
    currentCategory = name;
    catBtnLabel.textContent = CATEGORIES[name] + ' ' + name;
    catPop.querySelectorAll('.cat-chip').forEach((chip) => {
      chip.classList.toggle('selected', chip.dataset.cat === name);
    });
  }

  function openCatPop() {
    catPop.hidden = false;
    catBtn.classList.add('open');
  }

  function closeCatPop() {
    catPop.hidden = true;
    catBtn.classList.remove('open');
  }

  catBtn.addEventListener('click', () => {
    if (catPop.hidden) openCatPop();
    else closeCatPop();
  });

  catPop.addEventListener('click', (ev) => {
    const chip = ev.target.closest('.cat-chip');
    if (!chip) return;
    setCategory(chip.dataset.cat);
    closeCatPop();
  });

  // close on outside click or Escape
  document.addEventListener('click', (ev) => {
    if (catPop.hidden) return;
    if (ev.target.closest('#cat-select') || ev.target.closest('#cat-pop')) return;
    closeCatPop();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !catPop.hidden) closeCatPop();
  });

  /* ---------- Theme ---------- */

  const themeToggle = document.getElementById('theme-toggle');
  const systemDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  });

  // If the user hasn't picked a theme manually, follow the OS setting live
  if (systemDark && typeof systemDark.addEventListener === 'function') {
    systemDark.addEventListener('change', (e) => {
      let stored = null;
      try { stored = localStorage.getItem(THEME_KEY); } catch {}
      if (stored !== 'light' && stored !== 'dark') {
        document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
      }
    });
  }

  /* ---------- Tabs ---------- */

  const tabsNav = document.getElementById('tabs');
  tabsNav.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.tab-btn');
    if (!btn) return;
    tabsNav.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
    for (const id of ['dashboard', 'analytics', 'settings']) {
      document.getElementById('tab-' + id).hidden = id !== btn.dataset.tab;
    }
  });

  /* ---------- Analytics ---------- */

  const PALETTE = ['#3d5245', '#6f8b72', '#8ba491', '#a3bfa8', '#b3564d', '#7f9c8f', '#5b7263', '#c2a97e', '#9c7b6f', '#6d8b9c'];
  const donutEl = document.getElementById('cat-donut');
  const legendEl = document.getElementById('cat-legend');
  const anEmpty = document.getElementById('an-empty');
  const trendEl = document.getElementById('trend');

  function periodSince() {
    if (currentPeriod === 'month') {
      const now = new Date();
      return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-01';
    }
    if (currentPeriod === 'year') return new Date().getFullYear() + '-01-01';
    return null;
  }

  function renderAnalytics() {
    renderCatBreakdown();
    renderTrend();
    renderFacts();
  }

  function renderCatBreakdown() {
    const since = periodSince();
    const spendList = expenses.filter((e) => (!since || e.date >= since) && e.type !== 'income');
    const total = spendList.reduce((s, e) => s + e.amount, 0);

    legendEl.innerHTML = '';
    while (donutEl.firstChild) donutEl.removeChild(donutEl.firstChild);

    if (!total) {
      anEmpty.hidden = false;
      return;
    }
    anEmpty.hidden = true;

    const byCat = {};
    for (const e of spendList) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    let cum = 0;
    cats.forEach(([name, amt], i) => {
      const pct = (amt / total) * 100;
      const seg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      seg.setAttribute('cx', '21');
      seg.setAttribute('cy', '21');
      seg.setAttribute('r', '15.9155');
      seg.setAttribute('fill', 'none');
      seg.setAttribute('stroke', PALETTE[i % PALETTE.length]);
      seg.setAttribute('stroke-width', '5.5');
      seg.setAttribute('stroke-dasharray', pct + ' ' + (100 - pct));
      seg.setAttribute('stroke-dashoffset', String(25 - cum));
      donutEl.appendChild(seg);
      cum += pct;

      const li = document.createElement('li');
      li.innerHTML = '<span class="dot"></span><span class="em"></span><span class="name"></span><span class="amt"></span><span class="pct"></span>';
      li.querySelector('.dot').style.background = PALETTE[i % PALETTE.length];
      li.querySelector('.em').textContent = CATEGORIES[name] || '📦';
      li.querySelector('.name').textContent = name;
      li.querySelector('.amt').textContent = formatMoney(amt);
      li.querySelector('.pct').textContent = Math.round(pct) + '%';
      legendEl.appendChild(li);
    });
  }

  /* ---------- Analytics (cont) ---------- */

  function renderTrend() {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const inMonth = expenses.filter((e) => e.date.startsWith(key));
      months.push({
        label: d.toLocaleString('en', { month: 'short' }),
        inc: inMonth.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0),
        exp: inMonth.filter((e) => e.type !== 'income').reduce((s, e) => s + e.amount, 0)
      });
    }
    const max = Math.max(1, ...months.map((m) => Math.max(m.inc, m.exp)));

    trendEl.innerHTML = '';
    for (const m of months) {
      const col = document.createElement('div');
      col.className = 'tcol';
      col.innerHTML =
        '<div class="tbars">' +
          '<div class="tbar inc" role="img"></div>' +
          '<div class="tbar exp" role="img"></div>' +
        '</div>' +
        '<span class="tlabel"></span>';
      const incBar = col.querySelector('.tbar.inc');
      const expBar = col.querySelector('.tbar.exp');
      incBar.style.height = Math.max(m.inc > 0 ? 4 : 2, (m.inc / max) * 100) + '%';
      expBar.style.height = Math.max(m.exp > 0 ? 4 : 2, (m.exp / max) * 100) + '%';
      incBar.title = 'Income ' + formatMoney(m.inc);
      expBar.title = 'Spending ' + formatMoney(m.exp);
      col.querySelector('.tlabel').textContent = m.label;
      trendEl.appendChild(col);
    }
  }

  function renderFacts() {
    const since = periodSince();
    const list = expenses.filter((e) => !since || e.date >= since);
    const spendList = list.filter((e) => e.type !== 'income');
    const totalSpend = spendList.reduce((s, e) => s + e.amount, 0);

    const byCat = {};
    for (const e of spendList) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    const biggest = spendList.reduce((m, e) => (!m || e.amount > m.amount ? e : m), null);

    let days = 1;
    const now = new Date();
    if (currentPeriod === 'month') {
      days = now.getDate();
    } else if (currentPeriod === 'year') {
      const start = new Date(now.getFullYear(), 0, 1);
      days = Math.max(1, Math.round((now - start) / 86400000) + 1);
    } else if (expenses.length) {
      const first = expenses.reduce((m, e) => (e.date < m ? e.date : m), expenses[0].date);
      days = Math.max(1, Math.round((now - new Date(first + 'T00:00:00')) / 86400000) + 1);
    }

    const factsEl = document.getElementById('facts');
    factsEl.innerHTML = '';
    const items = [
      { label: 'Top spending category', value: top ? (CATEGORIES[top[0]] || '📦') + ' ' + top[0] + ' · ' + formatMoney(top[1]) : '—' },
      { label: 'Biggest single expense', value: biggest ? biggest.desc + ' · ' + formatMoney(biggest.amount) : '—' },
      { label: 'Average spend per day', value: formatMoney(totalSpend / days) }
    ];
    for (const it of items) {
      const div = document.createElement('div');
      div.className = 'fact';
      div.innerHTML = '<span></span><b></b>';
      div.querySelector('span').textContent = it.label;
      div.querySelector('b').textContent = it.value;
      factsEl.appendChild(div);
    }
  }

  /* ---------- Settings ---------- */

  const CURRENCY_KEY = 'karcha.currency';
  const currencySelect = document.getElementById('currency-select');
  const amountLabel = document.getElementById('amount-label');

  function applyCurrency() {
    currencySelect.value = currency;
    amountLabel.textContent = 'Amount (' + currency + ')';
  }

  currencySelect.addEventListener('change', () => {
    currency = currencySelect.value;
    try { localStorage.setItem(CURRENCY_KEY, currency); } catch {}
    applyCurrency();
    render();
  });

  const themeSeg = document.getElementById('theme-seg');

  function currentThemeMode() {
    let stored = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch {}
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  }

  function reflectTheme() {
    const mode = currentThemeMode();
    themeSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  }

  themeSeg.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (mode === 'system') {
      try { localStorage.removeItem(THEME_KEY); } catch {}
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = prefersDark ? 'dark' : 'light';
    } else {
      document.documentElement.dataset.theme = mode;
      try { localStorage.setItem(THEME_KEY, mode); } catch {}
    }
    reflectTheme();
  });

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  document.getElementById('export-json').addEventListener('click', () => {
    downloadFile('karcha-backup.json', JSON.stringify({ app: 'karcha', exported: new Date().toISOString(), expenses }, null, 2), 'application/json');
  });

  const importInput = document.getElementById('import-json');
  document.getElementById('import-btn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', () => {
    const file = importInput.files && importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const arr = Array.isArray(parsed) ? parsed : parsed && parsed.expenses;
        if (!Array.isArray(arr)) throw new Error('not a Karcha backup file');
        const clean = arr
          .map((e) => ({
            id: e && e.id ? String(e.id) : uid(),
            desc: e && e.desc != null ? String(e.desc).slice(0, 80) : '',
            amount: e && Number(e.amount) > 0 ? Number(e.amount) : 0,
            date: e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : todayISO(),
            type: e && e.type === 'income' ? 'income' : 'expense',
            category: e && CATEGORIES[e.category] ? e.category : 'Other'
          }))
          .filter((e) => e.desc && e.amount > 0);
        if (!clean.length) throw new Error('no valid entries found in file');
        if (!confirm('Replace current data with ' + clean.length + ' entries from this backup?')) return;
        expenses = clean;
        expenses.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
        save();
        render();
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
      importInput.value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('export-csv').addEventListener('click', () => {
    const rows = [['Date', 'Type', 'Category', 'Description', 'Amount']];
    for (const e of expenses) rows.push([e.date, e.type, e.category, e.desc, e.amount.toFixed(2)]);
    const csv = '\uFEFF' + rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    downloadFile('karcha.csv', csv, 'text/csv');
  });

  document.getElementById('wipe-data').addEventListener('click', clearAll);

  /* ---------- Init ---------- */

  // build category chip grid
  for (const name in CATEGORIES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'cat-chip';
    chip.dataset.cat = name;
    chip.innerHTML = '<span class="em"></span><span class="cat-name"></span>';
    chip.querySelector('.em').textContent = CATEGORIES[name];
    chip.querySelector('.cat-name').textContent = name;
    catPop.appendChild(chip);
  }
  setCategory(DEFAULT_CATEGORY.expense);
  applyCurrency();
  reflectTheme();

  dateInput.value = todayISO();
  render();
})();
