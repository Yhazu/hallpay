/* /assets/js/pages/application-details.js */
document.addEventListener('DOMContentLoaded', async () => {
  const role = document.body.dataset.role || 'citizen';
  if (document.body.dataset.public !== 'true') await requireAuth([role]);
  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([
    { label: role.charAt(0).toUpperCase() + role.slice(1), href: `/${role}/dashboard.html` },
    { label: 'My Applications', href: '/citizen/my-applications.html' },
    { label: 'Application Details' }
  ]);

  const mount = document.querySelector('[data-page-module]');
  if (!mount) return;

  const appId = getQueryParam('id');
  if (!appId) {
    renderApplicationDetailsEmpty(mount, 'Missing application ID', 'Open an application from My Applications to view its details.');
    return;
  }

  try {
    const application = await getApplication(appId);
    if (!application) {
      renderApplicationDetailsEmpty(mount, 'Application not found', 'The application may have been removed or you may not have access to it.');
      return;
    }

    const [assessment, receipt, permit] = await Promise.all([
      getAssessmentByApplicationId(application.id),
      getReceiptByApplicationId(application.id),
      getPermitByApplicationId(application.id)
    ]);
    renderApplicationDetails(mount, application, assessment, receipt, permit);
  } catch (error) {
    console.error('Application details error:', error);
    renderApplicationDetailsEmpty(mount, 'Unable to load application details', 'Please refresh the page or try again later.');
  }
});

function renderApplicationDetailsEmpty(mount, title, message) {
  mount.innerHTML = `
    <div class="empty-state card">
      <span class="material-symbols-outlined empty-state-icon">assignment_late</span>
      <h2 class="empty-state-title">${escapeHtml(title)}</h2>
      <p class="empty-state-text">${escapeHtml(message)}</p>
      <a class="btn btn-primary" href="/citizen/my-applications.html">Back to My Applications</a>
    </div>
  `;
}

function renderApplicationDetails(mount, application, assessment, receipt, permit) {
  const status = application.status || 'submitted';
  const formRows = Object.entries(application.formData || {});
  const documents = application.documents || [];
  const feeItems = assessment?.items || [];
  const totalAmount = assessment?.totalAmount || feeItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const canViewReceipt = ['paid', 'approved', 'readyForRelease', 'completed'].includes(status);
  const canViewPermit = ['approved', 'readyForRelease', 'completed'].includes(status);

  mount.innerHTML = `
    <div class="content-split">
      <section>
        <div class="card mb-4">
          <div class="card-header">
            <h2 class="card-title">Application Info</h2>
            ${renderStatusBadge(status)}
          </div>
          <div class="card-body">
            <dl class="details-list">
              ${detailsRow('Reference #', application.referenceNumber || application.id)}
              ${detailsRow('Service', application.serviceName || 'Municipal Service')}
              ${detailsRow('Submitted', formatDateTime(application.createdAt))}
              ${detailsRow('Last Updated', formatDateTime(application.updatedAt || application.createdAt))}
              ${application.remarks ? detailsRow('Remarks', application.remarks) : ''}
            </dl>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-header"><h2 class="card-title">Application Form Data</h2></div>
          <div class="card-body">
            ${formRows.length ? `<dl class="details-list">${formRows.map(([key, value]) => detailsRow(formatFieldLabel(key), value)).join('')}</dl>` : '<p class="empty-state-text">No form data was submitted.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2 class="card-title">Uploaded Documents</h2></div>
          <div class="card-body">
            ${documents.length ? documents.map(renderDocumentRow).join('') : '<p class="empty-state-text">No documents uploaded yet.</p>'}
          </div>
        </div>
      </section>

      <aside>
        <div class="card mb-4">
          <div class="card-header"><h2 class="card-title">Timeline</h2></div>
          <div class="card-body">${renderTimeline(application.statusHistory || [])}</div>
        </div>

        <div class="card mb-4">
          <div class="card-header"><h2 class="card-title">Fee Assessment</h2></div>
          <div class="card-body">
            ${feeItems.length ? `<dl class="details-list">${feeItems.map(item => detailsRow(item.label || 'Fee', formatCurrency(item.amount))).join('')}${detailsRow('Total', formatCurrency(totalAmount))}</dl>` : '<p class="empty-state-text">Fee assessment is not available yet.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h2 class="card-title">Actions</h2></div>
          <div class="card-body action-row">
            ${status === 'forPayment' && totalAmount > 0 ? `<a class="btn btn-primary" href="/citizen/payment.html?appId=${application.id}">Pay Now</a>` : ''}
            ${canViewReceipt ? `<a class="btn btn-secondary" href="/citizen/receipt-viewer.html?appId=${application.id}${receipt?.id ? `&id=${receipt.id}` : ''}">View Receipt</a>` : ''}
            ${canViewPermit ? `<a class="btn btn-secondary" href="/citizen/permit-viewer.html?appId=${application.id}${permit?.id ? `&id=${permit.id}` : ''}">View Permit</a>` : ''}
            <a class="btn btn-secondary" href="/citizen/support.html">Contact Support</a>
          </div>
        </div>
      </aside>
    </div>
  `;
}

function detailsRow(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? 'N/A')}</dd></div>`;
}

function renderDocumentRow(document) {
  const name = escapeHtml(document.name || document.fileName || 'Document');
  const url = document.url || '#';
  return `<p class="action-row">${name} <a class="btn btn-sm btn-secondary" href="${escapeHtml(url)}" target="_blank" rel="noopener">View</a></p>`;
}

function formatFieldLabel(key) {
  return String(key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, char => char.toUpperCase());
}
