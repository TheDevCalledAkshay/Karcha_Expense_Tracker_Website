/* Karcha — local-first expense tracker */
(function () {
  'use strict';

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

  const form = document.getElementById('expense-form');
  const listEl = document.getElementById('expense-list');
  const emptyEl = document.getElementById('empty-state');
  const clearBtn = document.getElementById('clear-all');
  const dateInput = document.getElementById('date');

  let expenses = [];
  let accountId = null;
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
    if (!accountId) return [];
    try {
      const raw = localStorage.getItem('karcha.expenses.' + accountId);
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
    if (!accountId) return;
    localStorage.setItem('karcha.expenses.' + accountId, JSON.stringify(expenses));
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

  // High-contrast donut palette: light/dark segments alternate so every slice
  // is distinguishable by brightness even for color-vision-deficient users.
  const PALETTE = ['#f7d377', '#a83226', '#b2e3a8', '#2b64b8', '#f9bcd4', '#5f3d9e', '#d1dc8c', '#0d5252', '#f8b173', '#333e45'];
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
      seg.setAttribute('stroke-width', '6');
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

  const currencySelect = document.getElementById('currency-select');
  const amountLabel = document.getElementById('amount-label');

  function applyCurrency() {
    currencySelect.value = currency;
    amountLabel.textContent = 'Amount (' + currency + ')';
  }

  currencySelect.addEventListener('change', () => {
    currency = currencySelect.value;
    try { localStorage.setItem('karcha.currency.' + accountId, currency); } catch {}
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

  /* ---------- Excel (.xls) export & import ---------- */

  const excelCols = ['Date', 'Type', 'Category', 'Description', 'Amount'];

  function rowsToExcelHtml(rows) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const head = excelCols.map((h) => '<th style="background:#22332c;color:#fffefb;padding:6px 12px;text-align:left">' + h + '</th>').join('');
    const body = rows
      .map((r) => '<tr>' + r.map((v) => '<td style="padding:4px 12px">' + esc(v) + '</td>').join('') + '</tr>')
      .join('');
    return (
      '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8">' +
      '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>' +
      '<x:Name>Karcha</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>' +
      '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->' +
      '</head><body><table border="1" cellspacing="0">' + head + body + '</table></body></html>'
    );
  }

  document.getElementById('export-excel').addEventListener('click', () => {
    const rows = expenses.map((e) => [e.date, e.type, e.category, e.desc, e.amount.toFixed(2)]);
    downloadFile('karcha.xls', rowsToExcelHtml(rows), 'application/vnd.ms-excel');
  });

  function normalizeDateCell(v) {
    // Accepts 12/31/2026, 31/12/2026, 2026-12-31 or Excel serial numbers.
    const s = String(v || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) {
      const a = +m[1], b = +m[2], y = +m[3];
      return y + '-' + String(a > 12 ? b : a).padStart(2, '0') + '-' + String(a > 12 ? a : b).padStart(2, '0');
    }
    if (/^\d{5}(\.\d+)?$/.test(s)) {
      const d = new Date(Math.round((Number(s) - 25569) * 86400000));
      return d.toISOString().slice(0, 10);
    }
    const d = new Date(s);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }

  function applyImportedRows(rows, sourceName) {
    const clean = rows
      .map((r) => {
        const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : normalizeDateCell(r.date);
        return {
          id: uid(),
          desc: String(r.desc || '').slice(0, 80),
          amount: Number(r.amount) > 0 ? Number(r.amount) : 0,
          date: date || todayISO(),
          type: r.type === 'income' ? 'income' : 'expense',
          category: CATEGORIES[r.category] ? r.category : 'Other'
        };
      })
      .filter((e) => e.desc && e.amount > 0);
    if (!clean.length) {
      alert('Import failed: no valid rows found in ' + sourceName + ' (expected columns: Date, Type, Category, Description, Amount).');
      return;
    }
    if (!confirm('Replace current data with ' + clean.length + ' entries from ' + sourceName + '?')) return;
    expenses = clean;
    expenses.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    save();
    render();
  }

  /* ---------- Excel (cont) ---------- */

  function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const split = (line) => {
      const out = [];
      let cur = '', q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (q) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') q = false;
          else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ',') { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur);
      return out;
    };
    return rowsFromTable(lines.map(split));
  }

  function parseXlsHtml(text) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return [];
    const trs = Array.from(table.querySelectorAll('tr'));
    return rowsFromTable(trs.map((tr) => Array.from(tr.querySelectorAll('th,td')).map((td) => td.textContent.trim())));
  }

  function rowsFromTable(rows) {
    if (!rows.length) return [];
    const header = rows[0].map((h) => String(h).trim().toLowerCase());
    const idx = (names) => header.findIndex((h) => names.includes(h));
    const iD = idx(['date']), iT = idx(['type']), iC = idx(['category']), iDesc = idx(['description', 'desc']), iA = idx(['amount']);
    if (iDesc === -1 || iA === -1) return [];
    return rows.slice(1).map((c) => ({
      date: iD > -1 ? c[iD] : '',
      type: iT > -1 ? c[iT] : '',
      category: iC > -1 ? c[iC] : '',
      desc: iDesc > -1 ? c[iDesc] : '',
      amount: iA > -1 ? c[iA] : ''
    }));
  }

  const excelInput = document.getElementById('import-excel');
  document.getElementById('import-excel-btn').addEventListener('click', () => excelInput.click());
  excelInput.addEventListener('change', () => {
    const file = excelInput.files && excelInput.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx')) {
      alert('Modern .xlsx files need extra libraries. Please re-save the file as "CSV UTF-8" or "Excel 97-2003 (.xls)" and import again.');
      excelInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = name.endsWith('.csv') ? parseCsv(String(reader.result)) : parseXlsHtml(String(reader.result));
        applyImportedRows(rows, file.name);
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
      excelInput.value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('wipe-data').addEventListener('click', clearAll);

  /* ---------- Accounts & Auth ---------- */

  const ACCOUNTS_KEY = 'karcha.accounts';
  const SESSION_KEY = 'karcha.session';
  const authScreen = document.getElementById('auth-screen');
  let pendingAccountId = null;

  function hashPin(pin, salt) {
    // Local-only deterrent: a light hash so the PIN isn't stored in plain text.
    let h = 5381;
    const s = String(salt) + '::' + String(pin);
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return 'djb2:' + h.toString(16);
  }

  function loadAccounts() {
    try {
      const arr = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  function startApp(id) {
    accountId = id;
    try { localStorage.setItem(SESSION_KEY, id); } catch {}
    expenses = load();
    try {
      const c = localStorage.getItem('karcha.currency.' + id);
      currency = CURRENCIES.includes(c) ? c : '₹';
    } catch {
      currency = '₹';
    }
    const acc = loadAccounts().find((a) => a.id === id);
    document.getElementById('account-name').textContent = acc ? acc.name : '—';
    document.getElementById('account-badge-name').textContent = acc ? acc.name : '';
    showPin(null);
    cancelEdit();
    authScreen.hidden = true;
    dateInput.value = todayISO();
    render();
  }

  function logoutToAuth() {
    try { localStorage.removeItem(SESSION_KEY); } catch {}
    accountId = null;
    expenses = [];
    cancelEdit();
    renderAuthList();
    authScreen.hidden = false;
    window.scrollTo(0, 0);
  }

  /* ---------- Auth (cont) ---------- */

  function renderAuthList() {
    const list = document.getElementById('auth-list');
    const divider = document.getElementById('auth-divider');
    if (divider) divider.style.display = loadAccounts().length ? '' : 'none';
    list.innerHTML = '';
    for (const a of loadAccounts()) {
      const row = document.createElement('div');
      row.className = 'auth-item';
      row.innerHTML =
        '<button type="button" class="auth-main">' +
          '<span class="avatar"></span>' +
          '<span class="a-name"></span>' +
          (a.pinHash ? '<span class="a-lock" title="PIN protected">🔒</span>' : '') +
        '</button>' +
        '<button type="button" class="auth-del" title="Delete account">✕</button>';
      row.querySelector('.avatar').textContent = (a.name[0] || '?').toUpperCase();
      row.querySelector('.a-name').textContent = a.name;
      row.querySelector('.auth-main').addEventListener('click', () => attemptLogin(a));
      row.querySelector('.auth-del').addEventListener('click', () => {
        if (!confirm('Delete "' + a.name + '" and all of its data? This cannot be undone.')) return;
        localStorage.removeItem('karcha.expenses.' + a.id);
        localStorage.removeItem('karcha.currency.' + a.id);
        saveAccounts(loadAccounts().filter((x) => x.id !== a.id));
        renderAuthList();
      });
      list.appendChild(row);
    }
  }

  function attemptLogin(acc) {
    if (acc.pinHash) showPin(acc);
    else startApp(acc.id);
  }

  function showPin(acc) {
    const choose = document.getElementById('auth-choose');
    const verify = document.getElementById('pin-verify');
    if (acc) {
      pendingAccountId = acc.id;
      document.getElementById('pin-name').textContent = acc.name;
      choose.hidden = true;
      verify.hidden = false;
      const pi = document.getElementById('pin-input');
      pi.value = '';
      document.getElementById('pin-err').hidden = true;
      pi.focus();
    } else {
      pendingAccountId = null;
      choose.hidden = false;
      verify.hidden = true;
    }
  }

  function tryPin() {
    const acc = loadAccounts().find((a) => a.id === pendingAccountId);
    const input = document.getElementById('pin-input');
    if (acc && acc.pinHash && hashPin(input.value.trim(), acc.id) === acc.pinHash) {
      showPin(null);
      startApp(acc.id);
    } else {
      document.getElementById('pin-err').hidden = false;
      input.value = '';
      input.focus();
      const card = document.querySelector('.auth-card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
    }
  }

  document.getElementById('pin-ok').addEventListener('click', tryPin);
  document.getElementById('pin-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') tryPin();
  });
  document.getElementById('pin-cancel').addEventListener('click', () => showPin(null));

  document.getElementById('register-form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = document.getElementById('new-account-name').value.trim();
    if (!name) return;
    const p1 = document.getElementById('new-account-pin').value.trim();
    const p2 = document.getElementById('new-account-pin2').value.trim();
    if ((p1 || p2) && (!/^\d{4}$/.test(p1) || p1 !== p2)) {
      alert('PIN must be exactly 4 digits and both fields must match.');
      return;
    }
    const id = uid();
    const accounts = loadAccounts();
    accounts.push({ id, name, pinHash: p1 ? hashPin(p1, id) : null, createdAt: new Date().toISOString() });
    saveAccounts(accounts);
    document.getElementById('new-account-name').value = '';
    document.getElementById('new-account-pin').value = '';
    document.getElementById('new-account-pin2').value = '';
    startApp(id);
  });

  document.getElementById('switch-account').addEventListener('click', logoutToAuth);

  document.getElementById('delete-account').addEventListener('click', () => {
    const acc = loadAccounts().find((a) => a.id === accountId);
    if (!acc) return;
    if (!confirm('Delete "' + acc.name + '" and ALL of its data? This cannot be undone.')) return;
    localStorage.removeItem('karcha.expenses.' + accountId);
    localStorage.removeItem('karcha.currency.' + accountId);
    saveAccounts(loadAccounts().filter((x) => x.id !== accountId));
    logoutToAuth();
  });

  document.getElementById('account-badge').addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="settings"]').click();
  });

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
  reflectTheme();
  renderAuthList();

  const savedSession = (() => {
    try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
  })();
  const currentAccount = savedSession && loadAccounts().find((a) => a.id === savedSession);
  if (currentAccount) startApp(currentAccount.id);
  else authScreen.hidden = false;
})();
