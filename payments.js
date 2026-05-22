/* /assets/js/pages/payments.js */
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
    { label: 'Payments' }
  ]);

  document.getElementById('pageTitle').textContent = role === 'admin' ? 'Payment Records' : 'Payments';
  document.getElementById('pageSubtitle').textContent = role === 'admin'
    ? 'Review payment confirmations and treasury records.'
    : 'Confirm and export payment records.';

  const mount = document.querySelector('[data-page-module]');
  const state = {
    payments: await getAllPayments(),
    query: '',
    status: 'All',
    from: '',
    to: '',
    role
  };

  renderPaymentsPage(mount, state);
});

function filteredPayments(state) {
  const query = state.query.trim().toLowerCase();
  return state.payments
    .filter(payment => state.status === 'All' || normalizePaymentStatus(payment.status) === state.status)
    .filter(payment => {
      const paidDate = toDate(payment.confirmedAt || payment.paidAt || payment.createdAt);
      if (state.from && paidDate < new Date(`${state.from}T00:00:00`)) return false;
      if (state.to && paidDate > new Date(`${state.to}T23:59:59`)) return false;
      return true;
    })
    .filter(payment => !query || [
      payment.referenceNumber,
      payment.serviceName,
      payment.citizenName,
      payment.method,
      payment.status
    ].some(value => String(value || '').toLowerCase().includes(query)))
    .sort((a, b) => toDate(b.confirmedAt || b.createdAt) - toDate(a.confirmedAt || a.createdAt));
}

function normalizePaymentStatus(status = 'pending') {
  const value = String(status).toLowerCase();
  if (['confirmed', 'paid', 'completed'].includes(value)) return 'confirmed';
  if (['failed', 'rejected', 'cancelled'].includes(value)) return 'failed';
  return 'pending';
}

function renderPaymentsPage(mount, state) {
  const rows = filteredPayments(state);
  const confirmedTotal = rows
    .filter(payment => normalizePaymentStatus(payment.status) === 'confirmed')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pendingCount = state.payments.filter(payment => normalizePaymentStatus(payment.status) === 'pending').length;
  const confirmedCount = state.payments.filter(payment => normalizePaymentStatus(payment.status) === 'confirmed').length;

  mount.innerHTML = `
    <section class="stats-grid">
      ${paymentStat('payments', 'Filtered Total', formatCurrency(confirmedTotal))}
      ${paymentStat('pending_actions', 'Pending Confirmation', pendingCount)}
      ${paymentStat('verified', 'Confirmed Payments', confirmedCount)}
      ${paymentStat('receipt_long', 'All Records', state.payments.length)}
    </section>

    <div class="card mb-4">
      <div class="card-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <span class="material-symbols-outlined">search</span>
            <input class="form-control search-input" id="paymentSearch" value="${escapeHtml(state.query)}" placeholder="Search reference, citizen, service, or method">
          </div>
          <select class="form-control table-select" id="paymentStatus">
            ${['All', 'pending', 'confirmed', 'failed'].map(status => `<option value="${status}" ${state.status === status ? 'selected' : ''}>${status === 'All' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}</option>`).join('')}
          </select>
          <input class="form-control table-select" type="date" id="paymentFrom" value="${escapeHtml(state.from)}" aria-label="From date">
          <input class="form-control table-select" type="date" id="paymentTo" value="${escapeHtml(state.to)}" aria-label="To date">
          <button class="btn btn-secondary" id="exportPaymentCsv"><span class="material-symbols-outlined">download</span>Export CSV</button>
        </div>
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr><th>Reference</th><th>Citizen</th><th>Service</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${rows.map(payment => `
            <tr>
              <td><strong>${escapeHtml(payment.referenceNumber || payment.id)}</strong></td>
              <td>${escapeHtml(payment.citizenName || payment.fullName || 'Citizen')}</td>
              <td>${escapeHtml(payment.serviceName || 'Municipal Service')}</td>
              <td>${formatCurrency(payment.amount || 0)}</td>
              <td>${escapeHtml(payment.method || 'Manual')}</td>
              <td>${paymentStatusBadge(payment.status)}</td>
              <td>${formatDate(payment.confirmedAt || payment.createdAt)}</td>
              <td>
                <div class="table-actions">
                  ${normalizePaymentStatus(payment.status) === 'pending'
                    ? `<a class="btn btn-sm btn-primary" href="/treasurer/confirm-payment.html?id=${payment.id}"><span class="material-symbols-outlined">fact_check</span>Confirm</a>`
                    : `<a class="btn btn-sm btn-secondary" href="/citizen/receipt-viewer.html?appId=${payment.applicationId || ''}&id=${payment.receiptId || payment.id}"><span class="material-symbols-outlined">receipt</span>Receipt</a>`}
                  <button class="btn btn-sm btn-secondary" data-view-payment="${payment.id}"><span class="material-symbols-outlined">visibility</span>View</button>
                </div>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="8">No payment records found.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="modal-overlay" id="paymentDetailsModal" hidden>
      <div class="modal">
        <div class="modal-header"><h2 class="modal-title">Payment Details</h2><button class="modal-close" data-close="paymentDetailsModal"><span class="material-symbols-outlined">close</span></button></div>
        <div class="modal-body" id="paymentDetailsBody"></div>
        <div class="modal-footer"><button class="btn btn-secondary" data-close="paymentDetailsModal">Close</button></div>
      </div>
    </div>
  `;

  document.getElementById('paymentSearch').addEventListener('input', debounce(event => {
    state.query = event.target.value;
    renderPaymentsPage(mount, state);
  }, 150));

  document.getElementById('paymentStatus').addEventListener('change', event => {
    state.status = event.target.value;
    renderPaymentsPage(mount, state);
  });

  document.getElementById('paymentFrom').addEventListener('change', event => {
    state.from = event.target.value;
    renderPaymentsPage(mount, state);
  });

  document.getElementById('paymentTo').addEventListener('change', event => {
    state.to = event.target.value;
    renderPaymentsPage(mount, state);
  });

  document.getElementById('exportPaymentCsv').addEventListener('click', () => exportPaymentCsv(rows));

  document.querySelectorAll('[data-view-payment]').forEach(button => {
    button.addEventListener('click', () => {
      const payment = state.payments.find(item => item.id === button.dataset.viewPayment);
      document.getElementById('paymentDetailsBody').innerHTML = renderPaymentDetails(payment);
      openModal('paymentDetailsModal');
    });
  });
}

function paymentStat(icon, label, value) {
  return `
    <article class="stat-card">
      <div class="stat-card-icon"><span class="material-symbols-outlined">${icon}</span></div>
      <div><div class="stat-card-value">${value}</div><div class="stat-card-label">${label}</div></div>
    </article>
  `;
}

function paymentStatusBadge(status) {
  const normalized = normalizePaymentStatus(status);
  const classes = { pending: 'badge-pay-pending', confirmed: 'badge-paid', failed: 'badge-rejected' };
  return `<span class="badge ${classes[normalized]}">${normalized.charAt(0).toUpperCase() + normalized.slice(1)}</span>`;
}

function renderPaymentDetails(payment) {
  if (!payment) return '<p>Payment not found.</p>';
  return `
    <dl class="details-list">
      <div><dt>Reference</dt><dd>${escapeHtml(payment.referenceNumber || payment.id)}</dd></div>
      <div><dt>Citizen</dt><dd>${escapeHtml(payment.citizenName || payment.fullName || 'Citizen')}</dd></div>
      <div><dt>Service</dt><dd>${escapeHtml(payment.serviceName || 'Municipal Service')}</dd></div>
      <div><dt>Amount</dt><dd>${formatCurrency(payment.amount || 0)}</dd></div>
      <div><dt>Method</dt><dd>${escapeHtml(payment.method || 'Manual')}</dd></div>
      <div><dt>Channel</dt><dd>${escapeHtml(payment.paymentChannel || 'N/A')}</dd></div>
      <div><dt>Transaction Ref.</dt><dd>${escapeHtml(payment.transactionReference || 'N/A')}</dd></div>
      <div><dt>Payer Details</dt><dd>${escapeHtml(payment.payerAccount || 'N/A')}</dd></div>
      <div><dt>Status</dt><dd>${paymentStatusBadge(payment.status)}</dd></div>
      <div><dt>Submitted</dt><dd>${formatDateTime(payment.createdAt)}</dd></div>
      <div><dt>Confirmed</dt><dd>${payment.confirmedAt ? formatDateTime(payment.confirmedAt) : 'Not confirmed yet'}</dd></div>
    </dl>
    ${payment.paymentNotes ? `<div class="alert alert-info"><span class="material-symbols-outlined">notes</span><span>${escapeHtml(payment.paymentNotes)}</span></div>` : ''}
    ${payment.proofUrl ? `<a class="btn btn-secondary" href="${payment.proofUrl}" target="_blank"><span class="material-symbols-outlined">image</span>View Proof</a>` : ''}
  `;
}

function exportPaymentCsv(rows) {
  const csvRows = [
    ['Reference', 'Citizen', 'Service', 'Amount', 'Method', 'Status', 'Date'],
    ...rows.map(payment => [
      payment.referenceNumber || payment.id,
      payment.citizenName || payment.fullName || 'Citizen',
      payment.serviceName || 'Municipal Service',
      payment.amount || 0,
      payment.method || 'Manual',
      normalizePaymentStatus(payment.status),
      formatDate(payment.confirmedAt || payment.createdAt)
    ])
  ];
  const csv = csvRows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'hallpay-payments.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}
