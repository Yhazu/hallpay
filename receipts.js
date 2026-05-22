/* /assets/js/pages/receipts.js */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth(['treasurer', 'admin']);
  const role = ['treasurer', 'admin'].includes(user.role) ? user.role : 'treasurer';

  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([
    { label: role === 'admin' ? 'Admin' : 'Treasurer', href: `/${role}/dashboard.html` },
    { label: 'Receipts' }
  ]);

  const title = document.getElementById('pageTitle');
  const subtitle = document.getElementById('pageSubtitle');
  if (title) title.textContent = 'Receipts';
  if (subtitle) subtitle.textContent = 'Search, review, export, and open official receipt records.';

  const mount = document.querySelector('[data-page-module]');
  const state = {
    payments: await getAllPayments(),
    query: '',
    method: 'All',
    from: '',
    to: ''
  };

  renderTreasurerReceipts(mount, state);
});

function receiptRows(state) {
  const query = state.query.trim().toLowerCase();
  return state.payments
    .filter(payment => ['confirmed', 'paid', 'completed'].includes(String(payment.status || '').toLowerCase()))
    .filter(payment => {
      const date = toDate(payment.confirmedAt || payment.paidAt || payment.createdAt);
      if (state.from && date < new Date(`${state.from}T00:00:00`)) return false;
      if (state.to && date > new Date(`${state.to}T23:59:59`)) return false;
      return true;
    })
    .filter(payment => state.method === 'All' || (payment.method || 'Manual') === state.method)
    .filter(payment => !query || [
      receiptNumber(payment),
      payment.referenceNumber,
      payment.citizenName,
      payment.payerName,
      payment.serviceName,
      payment.method
    ].some(value => String(value || '').toLowerCase().includes(query)))
    .sort((a, b) => toDate(b.confirmedAt || b.createdAt) - toDate(a.confirmedAt || a.createdAt));
}

function renderTreasurerReceipts(mount, state) {
  const rows = receiptRows(state);
  const methods = ['All', ...new Set(state.payments
    .filter(payment => ['confirmed', 'paid', 'completed'].includes(String(payment.status || '').toLowerCase()))
    .map(payment => payment.method || 'Manual'))];
  const totalCollected = rows.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const latest = rows[0];

  mount.innerHTML = `
    <section class="stats-grid">
      ${receiptStat('receipt_long', 'Issued Receipts', rows.length)}
      ${receiptStat('payments', 'Filtered Collection', formatCurrency(totalCollected))}
      ${receiptStat('account_balance_wallet', 'Payment Methods', Math.max(methods.length - 1, 0))}
      ${receiptStat('event_available', 'Latest Receipt', latest ? formatDate(latest.confirmedAt || latest.createdAt) : 'None')}
    </section>

    <div class="card mb-4">
      <div class="card-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <span class="material-symbols-outlined">search</span>
            <input class="form-control search-input" id="receiptSearch" value="${escapeHtml(state.query)}" placeholder="Search receipt, reference, citizen, service, or method">
          </div>
          <select class="form-control table-select" id="receiptMethod">
            ${methods.map(method => `<option value="${escapeHtml(method)}" ${state.method === method ? 'selected' : ''}>${escapeHtml(method === 'All' ? 'All Methods' : method)}</option>`).join('')}
          </select>
          <input class="form-control table-select" type="date" id="receiptFrom" value="${escapeHtml(state.from)}" aria-label="From date">
          <input class="form-control table-select" type="date" id="receiptTo" value="${escapeHtml(state.to)}" aria-label="To date">
          <button class="btn btn-secondary" id="exportReceiptCsv" type="button"><span class="material-symbols-outlined">download</span>Export CSV</button>
        </div>
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>Receipt No.</th><th>Reference</th><th>Citizen</th><th>Service</th><th>Amount</th><th>Method</th><th>Date</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${rows.map(payment => `
            <tr>
              <td><strong>${escapeHtml(receiptNumber(payment))}</strong></td>
              <td>${escapeHtml(payment.referenceNumber || payment.id)}</td>
              <td>${escapeHtml(payment.citizenName || payment.payerName || payment.fullName || 'Citizen')}</td>
              <td>${escapeHtml(payment.serviceName || 'Municipal Service')}</td>
              <td>${formatCurrency(payment.amount || 0)}</td>
              <td>${escapeHtml(payment.method || 'Manual')}</td>
              <td>${formatDate(payment.confirmedAt || payment.paidAt || payment.createdAt)}</td>
              <td>
                <div class="table-actions">
                  <a class="btn btn-sm btn-primary" href="${receiptViewerHref(payment)}"><span class="material-symbols-outlined">visibility</span>Open</a>
                  <button class="btn btn-sm btn-secondary" data-copy-receipt="${escapeHtml(receiptNumber(payment))}" type="button"><span class="material-symbols-outlined">content_copy</span>Copy No.</button>
                </div>
              </td>
            </tr>
          `).join('') || `
            <tr>
              <td colspan="8">
                <div class="empty-state compact-empty">
                  <span class="material-symbols-outlined empty-state-icon">receipt_long</span>
                  <h3>No issued receipts found</h3>
                  <p class="empty-state-text">Confirmed payments will appear here as official receipts.</p>
                </div>
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('receiptSearch').addEventListener('input', debounce(event => {
    state.query = event.target.value;
    renderTreasurerReceipts(mount, state);
  }, 150));

  document.getElementById('receiptMethod').addEventListener('change', event => {
    state.method = event.target.value;
    renderTreasurerReceipts(mount, state);
  });

  document.getElementById('receiptFrom').addEventListener('change', event => {
    state.from = event.target.value;
    renderTreasurerReceipts(mount, state);
  });

  document.getElementById('receiptTo').addEventListener('change', event => {
    state.to = event.target.value;
    renderTreasurerReceipts(mount, state);
  });

  document.getElementById('exportReceiptCsv').addEventListener('click', () => exportReceiptCsv(rows));

  document.querySelectorAll('[data-copy-receipt]').forEach(button => {
    button.addEventListener('click', () => {
      copyText(button.dataset.copyReceipt);
      showToast('Receipt number copied', 'success');
    });
  });
}

function receiptStat(icon, label, value) {
  return `
    <article class="stat-card">
      <div class="stat-card-icon"><span class="material-symbols-outlined">${icon}</span></div>
      <div><div class="stat-card-value">${value}</div><div class="stat-card-label">${label}</div></div>
    </article>
  `;
}

function receiptNumber(payment) {
  return payment.receiptNumber || payment.receiptId || payment.referenceNumber || payment.id || 'Receipt';
}

function receiptViewerHref(payment) {
  const params = new URLSearchParams();
  if (payment.applicationId) params.set('appId', payment.applicationId);
  params.set('id', payment.receiptId || payment.id);
  return `/citizen/receipt-viewer.html?${params.toString()}`;
}

function exportReceiptCsv(rows) {
  const csvRows = [
    ['Receipt No.', 'Reference', 'Citizen', 'Service', 'Amount', 'Method', 'Date'],
    ...rows.map(payment => [
      receiptNumber(payment),
      payment.referenceNumber || payment.id,
      payment.citizenName || payment.payerName || payment.fullName || 'Citizen',
      payment.serviceName || 'Municipal Service',
      payment.amount || 0,
      payment.method || 'Manual',
      formatDate(payment.confirmedAt || payment.paidAt || payment.createdAt)
    ])
  ];
  const csv = csvRows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'hallpay-receipts.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}
