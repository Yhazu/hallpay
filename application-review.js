/* /assets/js/pages/application-review.js */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth(['staff', 'admin']);
  const role = ['staff', 'admin'].includes(user.role) ? user.role : 'staff';
  const applicationsHref = role === 'admin' ? '/admin/dashboard.html' : '/staff/applications.html';

  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([
    { label: role === 'admin' ? 'Admin' : 'Staff', href: `/${role}/dashboard.html` },
    { label: role === 'admin' ? 'Dashboard' : 'Applications', href: applicationsHref },
    { label: 'Review' }
  ]);

  const mount = document.querySelector('[data-page-module]');
  const appId = getQueryParam('id');
  const application = await getApplication(appId);
  renderApplicationReview(mount, application, role);
});

function renderApplicationReview(mount, application, role = 'staff') {
  const backHref = role === 'admin' ? '/admin/dashboard.html' : '/staff/applications.html';

  if (!application) {
    mount.innerHTML = `<div class="empty-state card"><span class="material-symbols-outlined empty-state-icon">folder_off</span><h2 class="empty-state-title">Application not found</h2><a class="btn btn-primary" href="${backHref}">Back</a></div>`;
    return;
  }
  mount.innerHTML = `
    <div class="content-split">
      <section>
        <div class="card mb-4"><div class="card-header"><h2 class="card-title">Application Info</h2>${renderStatusBadge(application.status || 'submitted')}</div><div class="card-body">
          <p><strong>Reference:</strong> ${escapeHtml(application.referenceNumber || application.id)}</p>
          <p><strong>Service:</strong> ${escapeHtml(application.serviceName || '')}</p>
          <p><strong>Citizen:</strong> ${escapeHtml(application.citizenName || application.email || 'Citizen')}</p>
          <p><strong>Submitted:</strong> ${formatDateTime(application.createdAt)}</p>
        </div></div>
        <div class="card mb-4"><div class="card-header"><h2 class="card-title">Form Data</h2></div><div class="card-body">
          ${Object.entries(application.formData || {}).map(([key, value]) => `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</p>`).join('') || '<p>No form data.</p>'}
        </div></div>
        <div class="card"><div class="card-header"><h2 class="card-title">Documents</h2></div><div class="card-body">
          ${(application.documents || []).map(doc => `<p>${escapeHtml(doc.name || doc.fileName || 'Document')} <a class="btn btn-sm btn-secondary" href="${doc.url || '#'}" target="_blank">View</a></p>`).join('') || '<p>No documents uploaded.</p>'}
        </div></div>
      </section>
      <aside>
        <form class="card" id="statusForm">
          <div class="card-header"><h2 class="card-title">${role === 'admin' ? 'Admin Review' : 'Update Status'}</h2></div>
          <div class="card-body">
            ${role === 'admin' ? '<div class="alert alert-info"><span class="material-symbols-outlined">admin_panel_settings</span><span>Admin access is enabled for recent application review and status correction.</span></div>' : ''}
            <label class="form-group"><span class="form-label required">New Status</span><select class="form-control" name="status" required>
              ${['underReview','documentVerification','forAssessment','forPayment','approved','rejected','readyForRelease','completed'].map(status => `<option value="${status}" ${application.status === status ? 'selected' : ''}>${statusLabels[status]}</option>`).join('')}
            </select></label>
            <label class="form-group"><span class="form-label">Remarks</span><textarea class="form-control" name="remarks" placeholder="Remarks are required for rejection."></textarea></label>
            <button class="btn btn-primary btn-block">Save Update</button>
          </div>
        </form>
        <div class="card mt-4"><div class="card-header"><h2 class="card-title">Timeline</h2></div><div class="card-body">${renderTimeline(application.statusHistory || [])}</div></div>
      </aside>
    </div>
  `;
  document.getElementById('statusForm').addEventListener('submit', async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.status === 'rejected' && !data.remarks.trim()) {
      showToast('Remarks are required when rejecting an application.', 'warning');
      return;
    }
    await updateApplicationStatus(application.id, data.status, data.remarks || null);
    showToast('Application status updated.', 'success');
    location.href = `${location.pathname}?id=${application.id}`;
  });
}
