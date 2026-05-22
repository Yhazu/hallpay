/* /assets/js/pages/reports.js */
document.addEventListener('DOMContentLoaded', async () => {
  const role = document.body.dataset.role || 'admin';
  await requireAuth([role]);
  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([
    { label: role.charAt(0).toUpperCase() + role.slice(1), href: `/${role}/dashboard.html` },
    { label: 'Reports' }
  ]);

  const mount = document.querySelector('[data-page-module]');
  if (!mount) return;

  if (role === 'admin') {
    await renderAdminReports(mount);
    return;
  }

  await renderTreasurerReports(mount);
});

async function renderAdminReports(mount) {
  showLoader();
  try {
    const [applications, payments, users, services] = await Promise.all([
      getAllApplications(),
      getAllPayments(),
      getAllUsers(),
      getServices()
    ]);

    const state = {
      applications,
      payments,
      users,
      services,
      year: new Date().getFullYear(),
      category: 'All'
    };

    renderAdminReportsView(mount, state);
  } finally {
    hideLoader();
  }
}

async function renderTreasurerReports(mount) {
  const [payments, applications] = await Promise.all([getAllPayments(), getAllApplications()]);
  const state = { payments, applications, users: [], services: [], year: new Date().getFullYear(), category: 'All' };
  renderAdminReportsView(mount, state);
}

function renderAdminReportsView(mount, state) {
  const years = availableYears(state);
  const categories = ['All', ...new Set(state.services.map(service => service.category || 'Other'))];
  const filteredApplications = filterReportApplications(state);
  const filteredPayments = filterReportPayments(state, filteredApplications);
  const metrics = buildReportMetrics(state, filteredApplications, filteredPayments);

  mount.innerHTML = `
    <div class="card mb-4">
      <div class="card-body">
        <div class="filter-bar">
          <select class="form-control table-select" id="reportYear" aria-label="Report year">
            ${years.map(year => `<option value="${year}" ${Number(year) === Number(state.year) ? 'selected' : ''}>${year}</option>`).join('')}
          </select>
          <select class="form-control table-select" id="reportCategory" aria-label="Service category">
            ${categories.map(category => `<option value="${escapeHtml(category)}" ${state.category === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}
          </select>
          <button class="btn btn-secondary" id="exportRevenueCsv"><span class="material-symbols-outlined">download</span>Revenue CSV</button>
          <button class="btn btn-secondary" id="exportApplicationsCsv"><span class="material-symbols-outlined">download</span>Applications CSV</button>
          <button class="btn btn-secondary" id="exportUsersCsv"><span class="material-symbols-outlined">download</span>Users CSV</button>
        </div>
      </div>
    </div>

    <div class="stats-grid">
      ${reportStat('payments', 'Revenue This Year', formatCurrency(metrics.totalRevenue))}
      ${reportStat('description', 'Applications', metrics.applicationCount)}
      ${reportStat('verified', 'Approved / Completed', metrics.approvedCount)}
      ${reportStat('people', 'New Users', metrics.userCount)}
    </div>

    <div class="grid-2 mb-4">
      <section class="card report-chart-card">
        <div class="card-header">
          <h2 class="card-title">Revenue by Month</h2>
          <button class="btn btn-sm btn-secondary" data-export-chart="revenueMonth">Export</button>
        </div>
        <div class="card-body"><canvas id="revenueByMonthChart" class="report-chart-canvas"></canvas></div>
      </section>
      <section class="card report-chart-card">
        <div class="card-header">
          <h2 class="card-title">Applications by Service Type</h2>
          <button class="btn btn-sm btn-secondary" data-export-chart="applicationsService">Export</button>
        </div>
        <div class="card-body"><canvas id="applicationsByServiceChart" class="report-chart-canvas"></canvas></div>
      </section>
      <section class="card report-chart-card">
        <div class="card-header">
          <h2 class="card-title">User Registrations by Month</h2>
          <button class="btn btn-sm btn-secondary" data-export-chart="usersMonth">Export</button>
        </div>
        <div class="card-body"><canvas id="userRegistrationsChart" class="report-chart-canvas"></canvas></div>
      </section>
      <section class="card report-chart-card">
        <div class="card-header">
          <h2 class="card-title">Applications by Status</h2>
          <button class="btn btn-sm btn-secondary" data-export-chart="applicationsStatus">Export</button>
        </div>
        <div class="card-body"><canvas id="applicationsStatusChart" class="report-chart-canvas"></canvas></div>
      </section>
    </div>

    <div class="grid-4 mb-4">
      ${summaryTile('Most Applied Service', metrics.mostAppliedService)}
      ${summaryTile('Top Revenue Service', metrics.topRevenueService)}
      ${summaryTile('Average Processing Time', `${metrics.avgProcessingDays} days`)}
      ${summaryTile('Payment Method Leader', metrics.topPaymentMethod)}
    </div>

    <div class="grid-2">
      <section class="card">
        <div class="card-header"><h2 class="card-title">Top Services</h2></div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Service</th><th>Applications</th><th>Revenue</th><th>Approval Rate</th></tr></thead>
            <tbody>
              ${metrics.serviceRows.map(row => `
                <tr>
                  <td><strong>${escapeHtml(row.serviceName)}</strong><p class="table-muted">${escapeHtml(row.category)}</p></td>
                  <td>${row.count}</td>
                  <td>${formatCurrency(row.revenue)}</td>
                  <td>${row.approvalRate}%</td>
                </tr>
              `).join('') || '<tr><td colspan="4">No service data found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-header"><h2 class="card-title">Recent Report Records</h2></div>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Reference</th><th>Service</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              ${filteredApplications.slice(0, 8).map(app => `
                <tr>
                  <td><strong>${escapeHtml(app.referenceNumber || app.id)}</strong></td>
                  <td>${escapeHtml(app.serviceName || app.serviceId || 'Municipal Service')}</td>
                  <td>${renderStatusBadge(app.status || 'submitted')}</td>
                  <td>${formatDate(app.createdAt || app.updatedAt)}</td>
                </tr>
              `).join('') || '<tr><td colspan="4">No applications found.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;

  document.getElementById('reportYear').addEventListener('change', event => {
    state.year = Number(event.target.value);
    renderAdminReportsView(mount, state);
  });

  document.getElementById('reportCategory').addEventListener('change', event => {
    state.category = event.target.value;
    renderAdminReportsView(mount, state);
  });

  document.getElementById('exportRevenueCsv').addEventListener('click', () => exportReportCsv('hallpay-revenue-report.csv', revenueCsvRows(metrics)));
  document.getElementById('exportApplicationsCsv').addEventListener('click', () => exportReportCsv('hallpay-application-report.csv', applicationCsvRows(filteredApplications)));
  document.getElementById('exportUsersCsv').addEventListener('click', () => exportReportCsv('hallpay-user-report.csv', userCsvRows(state.users, state.year)));

  document.querySelectorAll('[data-export-chart]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.exportChart;
      exportReportCsv(`hallpay-${key}.csv`, chartCsvRows(metrics, key));
    });
  });

  renderReportCharts(metrics);
}

function availableYears(state) {
  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear, state.year]);
  [...state.applications, ...state.payments, ...state.users].forEach(item => {
    const date = toDate(item.createdAt || item.confirmedAt || item.paidAt || item.updatedAt);
    if (!Number.isNaN(date.getTime())) years.add(date.getFullYear());
  });
  return [...years].sort((a, b) => b - a);
}

function filterReportApplications(state) {
  const serviceById = new Map(state.services.map(service => [service.id, service]));
  return state.applications.filter(app => {
    const date = toDate(app.createdAt || app.updatedAt);
    const service = serviceById.get(app.serviceId);
    return date.getFullYear() === Number(state.year) && (state.category === 'All' || service?.category === state.category || app.category === state.category);
  });
}

function filterReportPayments(state, applications) {
  const appIds = new Set(applications.map(app => app.id));
  return state.payments.filter(payment => {
    const date = toDate(payment.confirmedAt || payment.paidAt || payment.createdAt);
    const appMatches = !payment.applicationId || appIds.has(payment.applicationId);
    return date.getFullYear() === Number(state.year) && appMatches && ['confirmed', 'paid', 'completed'].includes(String(payment.status || 'confirmed'));
  });
}

function buildReportMetrics(state, applications, payments) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    label: new Date(state.year, index, 1).toLocaleDateString('en-PH', { month: 'short' }),
    revenue: 0,
    applications: 0,
    users: 0
  }));
  const statusCounts = {};
  const serviceRows = new Map();
  const paymentMethods = {};
  const serviceById = new Map(state.services.map(service => [service.id, service]));

  applications.forEach(app => {
    const created = toDate(app.createdAt || app.updatedAt);
    months[created.getMonth()].applications += 1;
    statusCounts[app.status || 'submitted'] = (statusCounts[app.status || 'submitted'] || 0) + 1;
    const service = serviceById.get(app.serviceId) || {};
    const serviceName = app.serviceName || service.name || app.serviceId || 'Municipal Service';
    if (!serviceRows.has(serviceName)) {
      serviceRows.set(serviceName, {
        serviceName,
        category: service.category || app.category || 'Uncategorized',
        count: 0,
        approved: 0,
        revenue: 0,
        processingDays: []
      });
    }
    const row = serviceRows.get(serviceName);
    row.count += 1;
    if (['approved', 'completed', 'paid'].includes(app.status)) row.approved += 1;
    if (app.createdAt && app.updatedAt) {
      row.processingDays.push(Math.max(1, Math.round((toDate(app.updatedAt) - toDate(app.createdAt)) / 86400000)));
    }
  });

  payments.forEach(payment => {
    const paidDate = toDate(payment.confirmedAt || payment.paidAt || payment.createdAt);
    const amount = Number(payment.amount || payment.totalAmount || 0);
    months[paidDate.getMonth()].revenue += amount;
    paymentMethods[payment.method || 'Other'] = (paymentMethods[payment.method || 'Other'] || 0) + amount;
    const app = applications.find(item => item.id === payment.applicationId);
    const serviceName = payment.serviceName || app?.serviceName || 'Municipal Service';
    if (!serviceRows.has(serviceName)) {
      serviceRows.set(serviceName, { serviceName, category: 'Uncategorized', count: 0, approved: 0, revenue: 0, processingDays: [] });
    }
    serviceRows.get(serviceName).revenue += amount;
  });

  state.users.forEach(user => {
    const joined = toDate(user.createdAt || user.updatedAt);
    if (joined.getFullYear() === Number(state.year)) months[joined.getMonth()].users += 1;
  });

  const rows = [...serviceRows.values()]
    .map(row => ({
      ...row,
      approvalRate: row.count ? Math.round((row.approved / row.count) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count || b.revenue - a.revenue);

  const processingSamples = rows.flatMap(row => row.processingDays);
  const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount || payment.totalAmount || 0), 0);
  const topRevenueService = [...rows].sort((a, b) => b.revenue - a.revenue)[0]?.serviceName || 'No revenue yet';
  const topPaymentMethod = Object.entries(paymentMethods).sort((a, b) => b[1] - a[1])[0]?.[0] || 'No payments yet';

  return {
    months,
    statusCounts,
    paymentMethods,
    serviceRows: rows,
    totalRevenue,
    applicationCount: applications.length,
    approvedCount: applications.filter(app => ['approved', 'completed', 'paid'].includes(app.status)).length,
    userCount: state.users.filter(user => toDate(user.createdAt || user.updatedAt).getFullYear() === Number(state.year)).length,
    mostAppliedService: rows[0]?.serviceName || 'No applications yet',
    topRevenueService,
    avgProcessingDays: processingSamples.length ? Math.round(processingSamples.reduce((sum, days) => sum + days, 0) / processingSamples.length) : 0,
    topPaymentMethod
  };
}

function renderReportCharts(metrics) {
  if (!window.Chart) {
    showToast('Chart.js is not available on this page.', 'warning');
    return;
  }

  const chartConfigs = [
    ['revenueByMonthChart', {
      type: 'bar',
      data: {
        labels: metrics.months.map(item => item.label),
        datasets: [{ label: 'Revenue', data: metrics.months.map(item => item.revenue), backgroundColor: '#1A56A0' }]
      },
      options: chartOptions('Revenue')
    }],
    ['applicationsByServiceChart', {
      type: 'bar',
      data: {
        labels: metrics.serviceRows.slice(0, 8).map(row => row.serviceName),
        datasets: [{ label: 'Applications', data: metrics.serviceRows.slice(0, 8).map(row => row.count), backgroundColor: '#0277BD' }]
      },
      options: { ...chartOptions('Applications'), indexAxis: 'y' }
    }],
    ['userRegistrationsChart', {
      type: 'line',
      data: {
        labels: metrics.months.map(item => item.label),
        datasets: [{ label: 'Registrations', data: metrics.months.map(item => item.users), borderColor: '#2E7D32', backgroundColor: 'rgba(46,125,50,.12)', tension: 0.35, fill: true }]
      },
      options: chartOptions('Users')
    }],
    ['applicationsStatusChart', {
      type: 'doughnut',
      data: {
        labels: Object.keys(metrics.statusCounts).map(status => statusLabels[status] || status),
        datasets: [{ data: Object.values(metrics.statusCounts), backgroundColor: ['#1A56A0', '#F9A825', '#2E7D32', '#C62828', '#7C3AED', '#0277BD'] }]
      },
      options: chartOptions('Status')
    }]
  ];

  chartConfigs.forEach(([id, config]) => {
    const canvas = document.getElementById(id);
    if (canvas) new Chart(canvas, config);
  });
}

function chartOptions(label) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' }, tooltip: { mode: 'index', intersect: false } },
    scales: label === 'Status' ? undefined : { y: { beginAtZero: true, ticks: { precision: 0 } } }
  };
}

function reportStat(icon, label, value) {
  return `
    <div class="stat-card">
      <div class="stat-card-icon"><span class="material-symbols-outlined">${icon}</span></div>
      <div><div class="stat-card-value">${value}</div><div class="stat-card-label">${label}</div></div>
    </div>
  `;
}

function summaryTile(label, value) {
  return `
    <section class="card report-summary-tile">
      <div class="card-body">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    </section>
  `;
}

function revenueCsvRows(metrics) {
  return [['Month', 'Revenue'], ...metrics.months.map(item => [item.label, item.revenue])];
}

function applicationCsvRows(applications) {
  return [
    ['Reference', 'Service', 'Status', 'Submitted', 'Updated'],
    ...applications.map(app => [
      app.referenceNumber || app.id,
      app.serviceName || app.serviceId || 'Municipal Service',
      app.status || 'submitted',
      formatDate(app.createdAt || app.updatedAt),
      formatDate(app.updatedAt || app.createdAt)
    ])
  ];
}

function userCsvRows(users, year) {
  return [
    ['Name', 'Email', 'Role', 'Joined'],
    ...users
      .filter(user => toDate(user.createdAt || user.updatedAt).getFullYear() === Number(year))
      .map(user => [user.fullName || user.email || 'User', user.email || '', user.role || 'citizen', formatDate(user.createdAt || user.updatedAt)])
  ];
}

function chartCsvRows(metrics, key) {
  const maps = {
    revenueMonth: revenueCsvRows(metrics),
    applicationsService: [['Service', 'Applications', 'Revenue'], ...metrics.serviceRows.map(row => [row.serviceName, row.count, row.revenue])],
    usersMonth: [['Month', 'Registrations'], ...metrics.months.map(item => [item.label, item.users])],
    applicationsStatus: [['Status', 'Applications'], ...Object.entries(metrics.statusCounts).map(([status, count]) => [statusLabels[status] || status, count])]
  };
  return maps[key] || [['No data']];
}

function exportReportCsv(filename, rows) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
