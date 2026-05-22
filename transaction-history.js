/* /assets/js/pages/transaction-history.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['citizen']);
  if (window.renderSidebar) await renderSidebar('citizen');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Citizen', href: '/citizen/dashboard.html' }, { label: 'Transaction History' }]);

  const mount = document.querySelector('[data-page-module]');
  const state = {
    applications: await getUserApplications(window.currentUser.uid),
    payments: await getAllPayments(),
    query: '',
    status: 'All',
    from: '',
    to: '',
    page: 1,
    perPage: 10
  };

  renderTransactions(mount, state);
});

function buildTransactionRows(state) {
  return state.applications.map(application => {
    const payment = state.payments.find(item => item.applicationId === application.id) || {};
    return {
      id: application.id,
      referenceNumber: application.referenceNumber,
      serviceName: application.serviceName,
      amount: payment.amount || 0,
      method: payment.method || 'Not paid',
      status: payment.status || (application.status === 'forPayment' ? 'pending' : application.status),
      submittedAt: application.createdAt,
      paidAt: payment.confirmedAt || payment.createdAt || null,
      applicationStatus: application.status
    };
  });
}

function getFilteredTransactions(state) {
  const query = state.query.trim().toLowerCase();
  return buildTransactionRows(state)
    .filter(row => state.status === 'All' || String(row.status).toLowerCase() === state.status.toLowerCase())
    .filter(row => {
      if (!query) return true;
      return [row.referenceNumber, row.serviceName, row.method, row.status].some(value => String(value || '').toLowerCase().includes(query));
    })
    .filter(row => {
      const submitted = toDate(row.submittedAt);
      if (state.from && submitted < new Date(state.from)) return false;
      if (state.to && submitted > new Date(`${state.to}T23:59:59`)) return false;
      return true;
    })
    .sort((a, b) => toDate(b.submittedAt) - toDate(a.submittedAt));
}

function renderTransactionActions(row) {
  const actions = [`<a class="btn btn-sm btn-secondary" href="/citizen/application-details.html?id=${row.id}">View</a>`];
  if (['confirmed', 'paid', 'completed', 'approved'].includes(String(row.status).toLowerCase()) || ['paid', 'completed', 'approved'].includes(row.applicationStatus)) {
    actions.push(`<a class="btn btn-sm btn-secondary" href="/citizen/receipt-viewer.html?appId=${row.id}">Receipt</a>`);
  }
  if (['approved', 'readyForRelease', 'completed'].includes(row.applicationStatus)) {
    actions.push(`<a class="btn btn-sm btn-secondary" href="/citizen/permit-viewer.html?appId=${row.id}">Permit</a>`);
  }
  return actions.join('');
}

function exportTransactionsCsv(rows) {
  const header = ['Reference', 'Service', 'Amount', 'Method', 'Status', 'Date Submitted', 'Date Paid'];
  const body = rows.map(row => [
    row.referenceNumber,
    row.serviceName,
    row.amount,
    row.method,
    row.status,
    formatDate(row.submittedAt),
    row.paidAt ? formatDate(row.paidAt) : ''
  ]);
  const csv = [header, ...body].map(line => line.map(value => `"${String(value || '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  link.download = 'hallpay-transactions.csv';
  link.click();
}

function renderTransactions(mount, state) {
  const rows = getFilteredTransactions(state);
  const totalPages = Math.max(1, Math.ceil(rows.length / state.perPage));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.perPage;
  const pageRows = rows.slice(start, start + state.perPage);
  const totalPaid = rows.reduce((sum, row) => ['confirmed', 'paid', 'completed'].includes(String(row.status).toLowerCase()) ? sum + Number(row.amount || 0) : sum, 0);

  mount.innerHTML = `
    <div class="card mb-4">
      <div class="card-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <span class="material-symbols-outlined">search</span>
            <input class="form-control search-input" id="txSearch" value="${escapeHtml(state.query)}" placeholder="Search transactions">
          </div>
          <select class="form-control" id="txStatus" aria-label="Filter status">
            ${['All', 'pending', 'confirmed', 'paid', 'completed', 'failed'].map(status => `<option ${state.status === status ? 'selected' : ''}>${status}</option>`).join('')}
          </select>
          <input class="form-control" type="date" id="txFrom" value="${escapeHtml(state.from)}">
          <input class="form-control" type="date" id="txTo" value="${escapeHtml(state.to)}">
          <button class="btn btn-secondary" id="exportCsvBtn"><span class="material-symbols-outlined">download</span>Export CSV</button>
        </div>
      </div>
    </div>

    ${rows.length ? `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Ref #</th><th>Service</th><th>Amount</th><th>Payment Method</th><th>Status</th><th>Date Submitted</th><th>Date Paid</th><th>Actions</th></tr></thead>
          <tbody>
            ${pageRows.map(row => `
              <tr>
                <td><strong>${escapeHtml(row.referenceNumber)}</strong></td>
                <td>${escapeHtml(row.serviceName)}</td>
                <td>${formatCurrency(row.amount)}</td>
                <td>${escapeHtml(row.method)}</td>
                <td>${renderStatusBadge(row.applicationStatus || row.status)}</td>
                <td>${formatDate(row.submittedAt)}</td>
                <td>${row.paidAt ? formatDate(row.paidAt) : '—'}</td>
                <td><div class="table-actions">${renderTransactionActions(row)}</div></td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot><tr class="total-row"><td colspan="8">Total Paid: ${formatCurrency(totalPaid)}</td></tr></tfoot>
        </table>
        <div class="pagination">
          <span class="pagination-info">Showing ${start + 1}-${Math.min(start + state.perPage, rows.length)} of ${rows.length}</span>
          <div class="pagination-btns">
            <button class="pagination-btn" id="txPrev" ${state.page === 1 ? 'disabled' : ''}>Previous</button>
            <button class="pagination-btn active">${state.page}</button>
            <button class="pagination-btn" id="txNext" ${state.page === totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      </div>
    ` : `
      <div class="empty-state card">
        <span class="material-symbols-outlined empty-state-icon">receipt_long</span>
        <h2 class="empty-state-title">No transactions found</h2>
        <p class="empty-state-text">Payments and receipts will appear here after you submit or pay an application.</p>
        <a class="btn btn-primary" href="/citizen/services.html">Browse Services</a>
      </div>
    `}
  `;

  document.getElementById('txSearch')?.addEventListener('input', debounce(event => {
    state.query = event.target.value;
    state.page = 1;
    renderTransactions(mount, state);
  }, 150));
  document.getElementById('txStatus')?.addEventListener('change', event => {
    state.status = event.target.value;
    state.page = 1;
    renderTransactions(mount, state);
  });
  document.getElementById('txFrom')?.addEventListener('change', event => {
    state.from = event.target.value;
    state.page = 1;
    renderTransactions(mount, state);
  });
  document.getElementById('txTo')?.addEventListener('change', event => {
    state.to = event.target.value;
    state.page = 1;
    renderTransactions(mount, state);
  });
  document.getElementById('exportCsvBtn')?.addEventListener('click', () => exportTransactionsCsv(rows));
  document.getElementById('txPrev')?.addEventListener('click', () => {
    state.page -= 1;
    renderTransactions(mount, state);
  });
  document.getElementById('txNext')?.addEventListener('click', () => {
    state.page += 1;
    renderTransactions(mount, state);
  });
}
