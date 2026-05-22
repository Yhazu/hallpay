/* /assets/js/pages/verify-documents.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['staff']);
  if (window.renderSidebar) await renderSidebar('staff');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Staff', href: '/staff/dashboard.html' }, { label: 'Verify Documents' }]);

  const mount = document.querySelector('[data-page-module]');
  const applications = (await getAllApplications()).filter(app => ['submitted', 'underReview', 'documentVerification'].includes(app.status));
  mount.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr><th>Ref #</th><th>Service</th><th>Documents</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          ${applications.map(app => `<tr><td><strong>${escapeHtml(app.referenceNumber || app.id)}</strong></td><td>${escapeHtml(app.serviceName || '')}</td><td>${(app.documents || []).length}</td><td>${renderStatusBadge(app.status || 'submitted')}</td><td><a class="btn btn-sm btn-primary" href="/staff/application-review.html?id=${app.id}">Review Documents</a></td></tr>`).join('') || '<tr><td colspan="5">No documents are waiting for verification.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
});
