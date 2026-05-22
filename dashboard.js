/* /assets/js/pages/dashboard.js */
document.addEventListener('DOMContentLoaded', async () => {
  const role = document.body.dataset.role || 'citizen';
  if (document.body.dataset.public !== 'true') await requireAuth([role]);
  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();

  const mount = document.querySelector('[data-page-module]');
  const module = mount?.dataset.pageModule;
  setBreadcrumb([{ label: role.charAt(0).toUpperCase() + role.slice(1), href: `/${role}/dashboard.html` }, { label: 'Dashboard' }]);

  if (module === 'citizen-dashboard') {
    await renderCitizenDashboard(mount);
    return;
  }

  if (module === 'admin-dashboard') {
    await renderAdminDashboard(mount);
    return;
  }

  if (module === 'staff-dashboard') {
    await renderStaffDashboard(mount);
    return;
  }

  if (mount && window.HallPayPages) HallPayPages.render(module, mount);
});

function countByStatus(applications, statuses) {
  return applications.filter(application => statuses.includes(application.status)).length;
}

function nextActionForApplication(application) {
  if (application.status === 'forPayment') {
    return `<a class="btn btn-sm btn-primary" href="/citizen/payment.html?appId=${application.id}">Pay Now</a>`;
  }
  if (application.status === 'rejected') {
    return `<a class="btn btn-sm btn-warning" href="/citizen/upload-documents.html?id=${application.id}">Resubmit</a>`;
  }
  if (['paid', 'approved', 'completed'].includes(application.status)) {
    return `<a class="btn btn-sm btn-secondary" href="/citizen/receipt-viewer.html?appId=${application.id}">Receipt</a>`;
  }
  return `<a class="btn btn-sm btn-secondary" href="/citizen/application-details.html?id=${application.id}">View</a>`;
}

async function renderCitizenDashboard(mount) {
  const user = window.currentUser || demoUser;
  const [applications, announcements, services] = await Promise.all([
    getUserApplications(user.uid),
    getAnnouncements(),
    getServices()
  ]);

  const pendingCount = countByStatus(applications, ['submitted', 'underReview', 'documentVerification', 'forAssessment', 'forPayment', 'paymentPending']);
  const approvedCount = countByStatus(applications, ['approved', 'readyForRelease', 'completed']);
  const unpaidTotal = applications
    .filter(application => application.status === 'forPayment')
    .reduce((sum, application) => {
      const service = services.find(item => item.name === application.serviceName || item.id === application.serviceId);
      return sum + Number(service?.baseFee || 0);
    }, 0);
  const latestApplication = applications[0];

  document.getElementById('pageTitle').textContent = `Welcome back, ${user.fullName?.split(' ')[0] || 'Citizen'}!`;
  document.getElementById('pageSubtitle').textContent = 'Your municipal services, payments, and permits at a glance.';

  mount.innerHTML = `
    <section class="dashboard-hero">
      <div class="dashboard-hero-copy">
        <span class="dashboard-kicker">Municipal Payment and Permit Management</span>
        <h2>Manage applications without visiting every counter.</h2>
        <p>Track pending requirements, settle assessed fees, and keep verified receipts and permits in one account.</p>
        <div class="dashboard-hero-actions">
          <a class="btn btn-primary" href="/citizen/apply.html">
            <span class="material-symbols-outlined">edit_document</span>
            New Application
          </a>
          <a class="btn btn-secondary" href="/citizen/services.html">
            <span class="material-symbols-outlined">apps</span>
            Browse Services
          </a>
        </div>
      </div>
      <div class="dashboard-health">
        <div class="dashboard-health-item">
          <span class="material-symbols-outlined">schedule</span>
          <div>
            <strong>${latestApplication ? statusLabels[latestApplication.status] : 'Ready to apply'}</strong>
            <small>${latestApplication ? latestApplication.referenceNumber : 'No active application yet'}</small>
          </div>
        </div>
        <div class="dashboard-health-item">
          <span class="material-symbols-outlined">payments</span>
          <div>
            <strong>${formatCurrency(unpaidTotal)}</strong>
            <small>Current amount due</small>
          </div>
        </div>
      </div>
    </section>

    <section class="stats-grid dashboard-stats">
      ${renderDashboardStat('pending_actions', 'Pending Applications', pendingCount, 'Awaiting review, documents, or payment')}
      ${renderDashboardStat('verified', 'Approved / Completed', approvedCount, 'Released or ready municipal records')}
      ${renderDashboardStat('payments', 'Unpaid Balance', formatCurrency(unpaidTotal), 'Based on assessed applications')}
      ${renderDashboardStat('description', 'Total Applications', applications.length, 'All submitted service requests')}
    </section>

    <section class="dashboard-layout">
      <div class="dashboard-main">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Quick Actions</h2>
            <a class="btn btn-sm btn-secondary" href="/citizen/services.html">All Services</a>
          </div>
          <div class="card-body">
            <div class="dashboard-action-grid">
              ${[
                ['edit_document', 'Apply for Permit', 'Start a permit or certificate request.', '/citizen/apply.html'],
                ['payments', 'Pay Assessed Fees', 'Review balances and submit proof of payment.', '/citizen/fee-assessment.html'],
                ['track_changes', 'Track Application', 'Check the current status and staff remarks.', '/citizen/my-applications.html'],
                ['receipt_long', 'Receipts', 'Open official receipts and transaction records.', '/citizen/transaction-history.html'],
                ['campaign', 'Announcements', 'Read advisories, deadlines, and emergency notices.', '/citizen/announcements.html'],
                ['support_agent', 'Support', 'Ask for help with payments or applications.', '/citizen/support.html']
              ].map(action => `
                <a class="dashboard-action-card" href="${action[3]}">
                  <span class="material-symbols-outlined">${action[0]}</span>
                  <strong>${action[1]}</strong>
                  <small>${action[2]}</small>
                </a>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Recent Applications</h2>
            <a class="btn btn-sm btn-secondary" href="/citizen/my-applications.html">View All</a>
          </div>
          <div class="card-body">
            <div class="dashboard-application-list">
              ${applications.length ? applications.slice(0, 5).map(application => `
                <article class="dashboard-application-row">
                  <div>
                    <strong>${escapeHtml(application.serviceName)}</strong>
                    <small>${application.referenceNumber} | ${formatDate(application.createdAt)}</small>
                  </div>
                  <div class="dashboard-row-actions">
                    ${renderStatusBadge(application.status)}
                    ${nextActionForApplication(application)}
                  </div>
                </article>
              `).join('') : `
                <div class="dashboard-empty">
                  <span class="material-symbols-outlined">assignment</span>
                  <strong>No applications yet</strong>
                  <p>Start with a municipal service and your application will appear here.</p>
                  <a class="btn btn-primary" href="/citizen/services.html">Choose a Service</a>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>

      <aside class="dashboard-rail">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Next Steps</h2>
          </div>
          <div class="card-body">
            <ol class="dashboard-step-list">
              <li class="is-done"><span>1</span><div><strong>Create account</strong><small>Your profile is active.</small></div></li>
              <li class="${applications.length ? 'is-done' : 'is-current'}"><span>2</span><div><strong>Submit application</strong><small>Select a service and upload requirements.</small></div></li>
              <li class="${pendingCount ? 'is-current' : ''}"><span>3</span><div><strong>Track assessment</strong><small>Watch status changes and staff remarks.</small></div></li>
              <li><span>4</span><div><strong>Pay and download</strong><small>Get official receipts and permits.</small></div></li>
            </ol>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Announcements</h2>
            <a class="btn btn-sm btn-secondary" href="/citizen/announcements.html">View All</a>
          </div>
          <div class="card-body">
            <div class="dashboard-announcement-list">
              ${announcements.slice(0, 3).map(announcement => `
                <article class="dashboard-announcement-item ${announcement.category === 'Emergency' ? 'is-urgent' : ''}">
                  <span class="badge ${announcement.category === 'Emergency' ? 'badge-rejected' : 'badge-submitted'}">${escapeHtml(announcement.category)}</span>
                  <strong>${escapeHtml(announcement.title)}</strong>
                  <small>${formatDate(announcement.publishedAt)}</small>
                  <p>${escapeHtml(truncate(announcement.content, 110))}</p>
                </article>
              `).join('')}
            </div>
          </div>
        </div>
      </aside>
    </section>
  `;
}

function renderDashboardStat(icon, label, value, hint) {
  return `
    <article class="stat-card dashboard-stat-card">
      <div class="stat-card-icon">
        <span class="material-symbols-outlined">${icon}</span>
      </div>
      <div>
        <div class="stat-card-value">${value}</div>
        <div class="stat-card-label">${label}</div>
        <small>${hint}</small>
      </div>
    </article>
  `;
}

async function renderStaffDashboard(mount) {
  const applications = await getAllApplications();
  const today = new Date().toDateString();
  const month = new Date().getMonth();
  const actionable = applications
    .filter(app => ['submitted', 'underReview', 'documentVerification', 'forAssessment'].includes(app.status))
    .sort((a, b) => toDate(a.createdAt) - toDate(b.createdAt));
  const approvedToday = applications.filter(app => app.status === 'approved' && toDate(app.updatedAt || app.createdAt).toDateString() === today).length;
  const rejectedToday = applications.filter(app => app.status === 'rejected' && toDate(app.updatedAt || app.createdAt).toDateString() === today).length;
  const totalThisMonth = applications.filter(app => toDate(app.createdAt).getMonth() === month).length;

  document.getElementById('pageTitle').textContent = 'Staff Dashboard';
  document.getElementById('pageSubtitle').textContent = 'Prioritize review, document verification, and status updates.';

  mount.innerHTML = `
    <section class="stats-grid dashboard-stats">
      ${renderDashboardStat('rate_review', 'Pending Review', actionable.length, 'Oldest applications are prioritized')}
      ${renderDashboardStat('verified', 'Approved Today', approvedToday, 'Applications approved today')}
      ${renderDashboardStat('cancel', 'Rejected Today', rejectedToday, 'Applications returned to citizens')}
      ${renderDashboardStat('calendar_month', 'Total This Month', totalThisMonth, 'Applications submitted this month')}
    </section>
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Applications Needing Action</h2>
        <a class="btn btn-sm btn-secondary" href="/staff/applications.html">View All</a>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Ref #</th><th>Service</th><th>Citizen</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${actionable.map(app => `
              <tr>
                <td><strong>${escapeHtml(app.referenceNumber || app.id)}</strong></td>
                <td>${escapeHtml(app.serviceName || '')}</td>
                <td>${escapeHtml(app.citizenName || app.email || 'Citizen')}</td>
                <td>${formatDate(app.createdAt)}</td>
                <td>${renderStatusBadge(app.status || 'submitted')}</td>
                <td><a class="btn btn-sm btn-primary" href="/staff/application-review.html?id=${app.id}">Review</a></td>
              </tr>
            `).join('') || '<tr><td colspan="6">No applications need action.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function sumConfirmedRevenue(payments) {
  return payments
    .filter(payment => ['confirmed', 'paid', 'completed'].includes(String(payment.status || '').toLowerCase()))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

function sameMonthYear(value, month, year) {
  const date = toDate(value);
  return date.getMonth() === month && date.getFullYear() === year;
}

function statusCounts(applications) {
  return applications.reduce((acc, application) => {
    const label = statusLabels[application.status] || application.status || 'Submitted';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
}

async function renderAdminDashboard(mount) {
  showLoader();
  let users = [];
  let applications = [];
  let payments = [];
  let services = [];
  let announcements = [];
  let settings = defaultAppSettings();
  const adminFallback = async (label, loader, fallback) => {
    try {
      const value = await loader();
      return value || fallback;
    } catch (error) {
      console.warn(`Admin dashboard ${label} fallback:`, error);
      return fallback;
    }
  };

  try {
    [users, applications, payments, services, announcements, settings] = await Promise.all([
      adminFallback('users', getAllUsers, []),
      adminFallback('applications', getAllApplications, []),
      adminFallback('payments', getAllPayments, []),
      adminFallback('services', getServices, []),
      adminFallback('announcements', getAnnouncements, []),
      adminFallback('settings', getAppSettings, defaultAppSettings())
    ]);
  } finally {
    hideLoader();
  }

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const activeApplications = applications.filter(application => !['completed', 'rejected'].includes(application.status));
  const pendingApplications = applications.filter(application => ['submitted', 'underReview', 'documentVerification', 'forAssessment', 'forPayment', 'paymentPending'].includes(application.status));
  const pendingReview = applications.filter(application => ['submitted', 'underReview', 'documentVerification', 'forAssessment'].includes(application.status));
  const pendingPayments = payments.filter(payment => ['pending', 'paymentpending', 'forconfirmation'].includes(String(payment.status || '').toLowerCase()));
  const confirmedPayments = payments.filter(payment => ['confirmed', 'paid', 'completed'].includes(String(payment.status || '').toLowerCase()));
  const activeServices = services.filter(service => service.active !== false);
  const inactiveServices = services.filter(service => service.active === false);
  const monthlyRevenue = payments
    .filter(payment => {
      const date = toDate(payment.confirmedAt || payment.createdAt);
      return date.getMonth() === month && date.getFullYear() === year && ['confirmed', 'paid', 'completed'].includes(String(payment.status || '').toLowerCase());
    })
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const revenueByMonth = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, month - 5 + index, 1);
    const label = date.toLocaleDateString('en-PH', { month: 'short' });
    const value = payments
      .filter(payment => sameMonthYear(payment.confirmedAt || payment.createdAt, date.getMonth(), date.getFullYear()))
      .filter(payment => ['confirmed', 'paid', 'completed'].includes(String(payment.status || '').toLowerCase()))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { label, value };
  });
  const counts = statusCounts(applications);
  const roleCounts = users.reduce((acc, user) => {
    const role = user.role || 'citizen';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});
  const recentUsers = [...users].sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt)).slice(0, 5);
  const recentApps = [...applications].sort((a, b) => toDate(b.updatedAt || b.createdAt) - toDate(a.updatedAt || a.createdAt)).slice(0, 5);
  const serviceRows = buildAdminServiceRows(services, applications, payments);
  const recentActivity = [
    ...recentApps.map(application => ({
      icon: 'description',
      title: `${application.serviceName || 'Application'} updated`,
      body: `${application.referenceNumber || application.id} is ${statusLabels[application.status] || application.status}.`,
      date: application.updatedAt || application.createdAt
    })),
    ...payments.slice(0, 3).map(payment => ({
      icon: 'payments',
      title: `Payment ${payment.status || 'recorded'}`,
      body: `${payment.referenceNumber || payment.id} - ${formatCurrency(payment.amount || 0)}`,
      date: payment.confirmedAt || payment.createdAt
    }))
  ].sort((a, b) => toDate(b.date) - toDate(a.date)).slice(0, 6);

  document.getElementById('pageTitle').textContent = 'Admin Dashboard';
  document.getElementById('pageSubtitle').textContent = 'System health, applications, revenue, and municipal service activity.';

  mount.innerHTML = `
    <section class="admin-overview">
      <div class="admin-overview-copy">
        <span class="dashboard-kicker">HALL-PAY Administration</span>
        <h2>${escapeHtml(settings.municipality || 'Municipal')} operations control center.</h2>
        <p>Review user growth, active applications, collections, service availability, and recent system activity.</p>
      </div>
      <div class="admin-overview-actions">
        <button class="btn btn-secondary" type="button" id="adminRefreshBtn"><span class="material-symbols-outlined">refresh</span>Refresh</button>
        <button class="btn btn-secondary" type="button" id="adminExportBtn"><span class="material-symbols-outlined">download</span>Export CSV</button>
        <a class="btn btn-primary" href="/admin/users.html"><span class="material-symbols-outlined">people</span>Manage Users</a>
        <a class="btn btn-secondary" href="/admin/services.html"><span class="material-symbols-outlined">apps</span>Manage Services</a>
        <a class="btn btn-secondary" href="/admin/reports.html"><span class="material-symbols-outlined">bar_chart</span>Reports</a>
      </div>
    </section>

    <section class="stats-grid dashboard-stats">
      ${renderDashboardStat('people', 'Total Users', users.length, 'Registered accounts across all roles')}
      ${renderDashboardStat('pending_actions', 'Active Applications', activeApplications.length, 'Open workflow items')}
      ${renderDashboardStat('payments', 'Revenue This Month', formatCurrency(monthlyRevenue), 'Confirmed and recorded payments')}
      ${renderDashboardStat('schedule', 'Pending', pendingApplications.length, 'Need review, payment, or confirmation')}
    </section>

    <section class="admin-health-grid">
      ${renderAdminHealthItem('database', 'Firebase', isFirebaseConfigured() ? 'Connected' : 'Demo mode', isFirebaseConfigured() ? 'healthy' : 'warning')}
      ${renderAdminHealthItem('construction', 'Maintenance', settings.maintenanceMode ? 'Enabled' : 'Disabled', settings.maintenanceMode ? 'warning' : 'healthy')}
      ${renderAdminHealthItem('qr_code_scanner', 'QR Verification', settings.enableQrVerification ? 'Enabled' : 'Disabled', settings.enableQrVerification ? 'healthy' : 'warning')}
      ${renderAdminHealthItem('mail', 'Email Queue', settings.enableEmailNotifications ? 'Enabled' : 'Disabled', settings.enableEmailNotifications ? 'healthy' : 'warning')}
    </section>

    <section class="dashboard-layout">
      <div class="dashboard-main">
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><h2 class="card-title">Applications by Status</h2></div>
            <div class="card-body"><canvas id="adminStatusChart" height="220"></canvas></div>
          </div>
          <div class="card">
            <div class="card-header"><h2 class="card-title">Revenue Trend</h2></div>
            <div class="card-body"><canvas id="adminRevenueChart" height="220"></canvas></div>
          </div>
        </div>

        <div class="grid-2">
          <div class="card">
          <div class="card-header">
            <h2 class="card-title">Payment Confirmation Queue</h2>
            <a class="btn btn-sm btn-secondary" href="/treasurer/payments.html">Open Payments</a>
          </div>
          <div class="card-body">
            <div class="search-input-wrapper">
              <span class="material-symbols-outlined">search</span>
              <input class="form-control search-input" id="adminPaymentSearch" placeholder="Search payment queue">
            </div>
          </div>
          <div class="table-wrapper">
              <table id="adminPaymentsTable">
                <thead><tr><th>Reference</th><th>Service</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  ${pendingPayments.slice(0, 5).map(payment => `
                    <tr>
                      <td><strong>${escapeHtml(payment.referenceNumber || payment.id)}</strong></td>
                      <td>${escapeHtml(payment.serviceName || 'Municipal Service')}</td>
                      <td>${formatCurrency(payment.amount || 0)}</td>
                      <td><span class="badge badge-pay-pending">${escapeHtml(payment.status || 'pending')}</span></td>
                      <td><a class="btn btn-sm btn-primary" href="/treasurer/confirm-payment.html?id=${payment.id}">Confirm</a></td>
                    </tr>
                  `).join('') || '<tr><td colspan="5">No payments waiting for confirmation.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h2 class="card-title">User Roles</h2>
              <a class="btn btn-sm btn-secondary" href="/admin/users.html">Manage Roles</a>
            </div>
            <div class="card-body admin-role-list">
              ${['citizen', 'staff', 'treasurer', 'admin'].map(role => `
                <div class="admin-role-row">
                  <span>${role.charAt(0).toUpperCase() + role.slice(1)}</span>
                  <strong>${roleCounts[role] || 0}</strong>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Recent Applications</h2>
            <a class="btn btn-sm btn-secondary" href="/staff/applications.html">Open Review Queue</a>
          </div>
          <div class="card-body">
            <div class="filter-bar">
              <div class="search-input-wrapper">
                <span class="material-symbols-outlined">search</span>
                <input class="form-control search-input" id="adminApplicationSearch" placeholder="Search reference, service, or status">
              </div>
              <select class="form-control" id="adminApplicationStatus" style="max-width:220px">
                <option value="All">All statuses</option>
                ${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="table-wrapper">
            <table id="adminApplicationsTable">
              <thead><tr><th>Reference</th><th>Service</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead>
              <tbody>
                ${recentApps.map(application => `
                  <tr data-status="${escapeHtml(application.status || 'submitted')}">
                    <td><strong>${escapeHtml(application.referenceNumber || application.id)}</strong></td>
                    <td>${escapeHtml(application.serviceName || 'Municipal Service')}</td>
                    <td>${renderStatusBadge(application.status || 'submitted')}</td>
                    <td>${formatDate(application.updatedAt || application.createdAt)}</td>
                    <td><a class="btn btn-sm btn-secondary" href="/staff/application-review.html?id=${application.id}">Review</a></td>
                  </tr>
                `).join('') || '<tr><td colspan="5">No applications yet.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Service Coverage</h2>
            <a class="btn btn-sm btn-secondary" href="/admin/services.html">Manage Services</a>
          </div>
          <div class="card-body">
            <div class="search-input-wrapper">
              <span class="material-symbols-outlined">search</span>
              <input class="form-control search-input" id="adminServiceSearch" placeholder="Search service coverage">
            </div>
          </div>
          <div class="table-wrapper">
            <table id="adminServicesTable">
              <thead><tr><th>Service</th><th>Category</th><th>Applications</th><th>Revenue</th><th>Active</th></tr></thead>
              <tbody>
                ${serviceRows.slice(0, 6).map(service => `
                  <tr>
                    <td><strong>${escapeHtml(service.name)}</strong></td>
                    <td>${escapeHtml(service.category)}</td>
                    <td>${service.applications}</td>
                    <td>${formatCurrency(service.revenue)}</td>
                    <td>${service.active ? '<span class="badge badge-approved">Active</span>' : '<span class="badge badge-draft">Inactive</span>'}</td>
                  </tr>
                `).join('') || '<tr><td colspan="5">No services configured.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <aside class="dashboard-rail">
        <div class="card">
          <div class="card-header"><h2 class="card-title">Operations Snapshot</h2></div>
          <div class="card-body admin-snapshot-list">
            ${renderAdminSnapshot('Pending staff review', pendingReview.length, '/staff/applications.html')}
            ${renderAdminSnapshot('Payments confirmed', confirmedPayments.length, '/treasurer/payments.html')}
            ${renderAdminSnapshot('Active services', activeServices.length, '/admin/services.html')}
            ${renderAdminSnapshot('Inactive services', inactiveServices.length, '/admin/services.html')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">System Shortcuts</h2>
          </div>
          <div class="card-body admin-shortcuts">
            ${[
              ['people', 'Users', '/admin/users.html', `${users.length} accounts`],
              ['apps', 'Services', '/admin/services.html', `${activeServices.length} active services`],
              ['campaign', 'Announcements', '/admin/announcements.html', `${announcements.length} published items`],
              ['settings', 'Settings', '/admin/settings.html', 'Configure defaults']
            ].map(item => `
              <a class="admin-shortcut" href="${item[2]}">
                <span class="material-symbols-outlined">${item[0]}</span>
                <div><strong>${item[1]}</strong><small>${item[3]}</small></div>
              </a>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Recent Registrations</h2>
            <a class="btn btn-sm btn-secondary" href="/admin/users.html">View All</a>
          </div>
          <div class="card-body admin-mini-list">
            ${recentUsers.map(user => `
              <div class="admin-mini-row">
                <div class="avatar">${escapeHtml((user.fullName || user.email || 'U').charAt(0).toUpperCase())}</div>
                <div>
                  <strong>${escapeHtml(user.fullName || user.email || 'User')}</strong>
                  <small>${escapeHtml(user.role || 'citizen')} | ${formatDate(user.createdAt || new Date())}</small>
                </div>
              </div>
            `).join('') || '<p>No users yet.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Announcements</h2>
            <a class="btn btn-sm btn-secondary" href="/admin/announcements.html">Manage</a>
          </div>
          <div class="card-body dashboard-announcement-list">
            ${announcements.slice(0, 3).map(announcement => `
              <article class="dashboard-announcement-item ${announcement.category === 'Emergency' ? 'is-urgent' : ''}">
                <span class="badge ${announcement.category === 'Emergency' ? 'badge-rejected' : announcement.category === 'Deadline' ? 'badge-pay-pending' : 'badge-submitted'}">${escapeHtml(announcement.category || 'Advisory')}</span>
                <strong>${escapeHtml(announcement.title)}</strong>
                <small>${formatDate(announcement.publishedAt || announcement.createdAt)}</small>
              </article>
            `).join('') || '<p>No published announcements.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2 class="card-title">Recent Activity</h2></div>
          <div class="card-body admin-activity-list">
            ${recentActivity.map(item => `
              <div class="admin-activity-row">
                <span class="material-symbols-outlined">${item.icon}</span>
                <div>
                  <strong>${escapeHtml(item.title)}</strong>
                  <small>${escapeHtml(item.body)} | ${formatRelativeTime(item.date)}</small>
                </div>
              </div>
            `).join('') || '<p>No activity yet.</p>'}
          </div>
        </div>
      </aside>
    </section>
  `;

  renderAdminCharts(counts, revenueByMonth);
  bindAdminDashboardControls({ mount, users, applications, payments, services, announcements, settings });
}

function bindAdminDashboardControls(state) {
  document.getElementById('adminRefreshBtn')?.addEventListener('click', () => {
    renderAdminDashboard(state.mount);
  });

  document.getElementById('adminExportBtn')?.addEventListener('click', () => {
    const rows = [
      ['Metric', 'Value'],
      ['Users', state.users.length],
      ['Applications', state.applications.length],
      ['Payments', state.payments.length],
      ['Services', state.services.length],
      ['Announcements', state.announcements.length],
      ['Confirmed Revenue', sumConfirmedRevenue(state.payments)]
    ];
    downloadAdminCsv('hallpay-admin-dashboard.csv', rows);
    showToast('Admin dashboard CSV exported.', 'success');
  });

  bindAdminTableSearch('adminPaymentSearch', 'adminPaymentsTable');
  bindAdminTableSearch('adminServiceSearch', 'adminServicesTable');
  bindAdminApplicationFilters();
}

function bindAdminTableSearch(inputId, tableId) {
  const input = document.getElementById(inputId);
  const table = document.getElementById(tableId);
  if (!input || !table) return;

  input.addEventListener('input', debounce(() => {
    const query = input.value.trim().toLowerCase();
    table.querySelectorAll('tbody tr').forEach(row => {
      row.hidden = query && !row.textContent.toLowerCase().includes(query);
    });
  }, 120));
}

function bindAdminApplicationFilters() {
  const input = document.getElementById('adminApplicationSearch');
  const status = document.getElementById('adminApplicationStatus');
  const table = document.getElementById('adminApplicationsTable');
  if (!input || !status || !table) return;

  const apply = debounce(() => {
    const query = input.value.trim().toLowerCase();
    const selected = status.value;
    table.querySelectorAll('tbody tr').forEach(row => {
      const text = row.textContent.toLowerCase();
      const rowStatus = row.dataset.status || '';
      row.hidden = Boolean(query && !text.includes(query)) || Boolean(selected !== 'All' && rowStatus !== selected);
    });
  }, 120);

  input.addEventListener('input', apply);
  status.addEventListener('change', apply);
}

function downloadAdminCsv(fileName, rows) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function buildAdminServiceRows(services, applications, payments) {
  return services.map(service => {
    const serviceApplications = applications.filter(app => app.serviceId === service.id || app.serviceName === service.name);
    const applicationIds = new Set(serviceApplications.map(app => app.id));
    const revenue = payments
      .filter(payment => payment.serviceName === service.name || applicationIds.has(payment.applicationId))
      .filter(payment => ['confirmed', 'paid', 'completed'].includes(String(payment.status || '').toLowerCase()))
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      name: service.name || service.id,
      category: service.category || 'Uncategorized',
      applications: serviceApplications.length,
      revenue,
      active: service.active !== false
    };
  }).sort((a, b) => b.applications - a.applications || b.revenue - a.revenue);
}

function renderAdminHealthItem(icon, label, value, tone) {
  return `
    <article class="admin-health-item ${tone}">
      <span class="material-symbols-outlined">${icon}</span>
      <div>
        <strong>${label}</strong>
        <small>${value}</small>
      </div>
    </article>
  `;
}

function renderAdminSnapshot(label, value, href) {
  return `
    <a class="admin-snapshot-row" href="${href}">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </a>
  `;
}

function renderAdminCharts(counts, revenueByMonth) {
  const statusCanvas = document.getElementById('adminStatusChart');
  const revenueCanvas = document.getElementById('adminRevenueChart');
  if (!statusCanvas || !revenueCanvas) return;

  if (!window.Chart) {
    statusCanvas.parentElement.innerHTML = renderChartFallback(
      Object.entries(counts).map(([label, value]) => ({ label, value })),
      'No application status data yet.'
    );
    revenueCanvas.parentElement.innerHTML = renderChartFallback(
      revenueByMonth.map(item => ({ label: item.label, value: formatCurrency(item.value) })),
      'No revenue data yet.'
    );
    return;
  }

  new Chart(statusCanvas, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts).length ? Object.keys(counts) : ['No Applications'],
      datasets: [{ data: Object.values(counts).length ? Object.values(counts) : [1], backgroundColor: ['#1A56A0', '#F9A825', '#2E7D32', '#C62828', '#7C3AED', '#0277BD'] }]
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
  });

  new Chart(revenueCanvas, {
    type: 'line',
    data: {
      labels: revenueByMonth.map(item => item.label),
      datasets: [{ label: 'Revenue', data: revenueByMonth.map(item => item.value), borderColor: '#1A56A0', backgroundColor: 'rgba(26,86,160,.12)', fill: true, tension: .35 }]
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

function renderChartFallback(items, emptyText) {
  const visible = items.filter(item => Number(item.value) || String(item.value || '').replace(/[^\d.]/g, '') !== '0');
  if (!visible.length) return `<div class="empty-state"><span class="material-symbols-outlined empty-state-icon">bar_chart</span><p>${escapeHtml(emptyText)}</p></div>`;
  return `
    <div class="admin-chart-fallback">
      ${items.map(item => `
        <div class="admin-snapshot-row">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}
