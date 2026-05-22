/* /assets/js/pages/applications.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['staff']);
  if (window.renderSidebar) await renderSidebar('staff');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Staff', href: '/staff/dashboard.html' }, { label: 'Applications' }]);

  const mount = document.querySelector('[data-page-module]');
  const state = { applications: await getAllApplications(), status: 'All', query: '' };
  renderStaffApplications(mount, state);
});

function staffFilteredApplications(state) {
  const query = state.query.trim().toLowerCase();
  return state.applications
    .filter(app => state.status === 'All' || app.status === state.status)
    .filter(app => !query || [app.referenceNumber, app.serviceName, app.citizenName, app.status].some(value => String(value || '').toLowerCase().includes(query)))
    .sort((a, b) => toDate(a.createdAt) - toDate(b.createdAt));
}

function renderStaffApplications(mount, state) {
  const apps = staffFilteredApplications(state);
  mount.innerHTML = `
    <div class="card mb-4"><div class="card-body"><div class="filter-bar">
      <div class="search-input-wrapper"><span class="material-symbols-outlined">search</span><input class="form-control search-input" id="appSearch" value="${escapeHtml(state.query)}" placeholder="Search applications"></div>
      <select class="form-control" id="appStatus">${['All','submitted','underReview','documentVerification','forAssessment','forPayment','approved','rejected','completed'].map(status => `<option value="${status}" ${state.status === status ? 'selected' : ''}>${status === 'All' ? 'All' : statusLabels[status] || status}</option>`).join('')}</select>
    </div></div></div>
    <div class="table-wrapper"><table><thead><tr><th>Ref #</th><th>Service</th><th>Citizen</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>
      ${apps.map(app => `<tr><td><strong>${escapeHtml(app.referenceNumber || app.id)}</strong></td><td>${escapeHtml(app.serviceName || '')}</td><td>${escapeHtml(app.citizenName || app.email || 'Citizen')}</td><td>${formatDate(app.createdAt)}</td><td>${renderStatusBadge(app.status || 'submitted')}</td><td><a class="btn btn-sm btn-primary" href="/staff/application-review.html?id=${app.id}">Review</a></td></tr>`).join('') || '<tr><td colspan="6">No applications found.</td></tr>'}
    </tbody></table></div>
  `;
  document.getElementById('appSearch').addEventListener('input', debounce(event => {
    state.query = event.target.value;
    renderStaffApplications(mount, state);
  }, 150));
  document.getElementById('appStatus').addEventListener('change', event => {
    state.status = event.target.value;
    renderStaffApplications(mount, state);
  });
}
