/* /assets/js/pages/update-status.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['staff']);
  if (window.renderSidebar) await renderSidebar('staff');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Staff', href: '/staff/dashboard.html' }, { label: 'Update Status' }]);

  const mount = document.querySelector('[data-page-module]');
  const applications = await getAllApplications();
  mount.innerHTML = `
    <div class="alert alert-info">
      <span class="material-symbols-outlined">info</span>
      Choose an application to open the review screen and record an official status update.
    </div>
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Ref #</th><th>Service</th><th>Current Status</th><th>Updated</th><th>Action</th></tr></thead>
        <tbody>
          ${applications.map(app => `<tr><td><strong>${escapeHtml(app.referenceNumber || app.id)}</strong></td><td>${escapeHtml(app.serviceName || '')}</td><td>${renderStatusBadge(app.status || 'submitted')}</td><td>${formatDate(app.updatedAt || app.createdAt)}</td><td><a class="btn btn-sm btn-primary" href="/staff/application-review.html?id=${app.id}">Update</a></td></tr>`).join('') || '<tr><td colspan="5">No applications available.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
});
