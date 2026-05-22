/* /assets/js/pages/upload-documents.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['citizen']);
  if (window.renderSidebar) await renderSidebar('citizen');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Citizen', href: '/citizen/dashboard.html' }, { label: 'Upload Documents' }]);

  const mount = document.querySelector('[data-page-module]');
  const appId = getQueryParam('id') || getQueryParam('appId');
  if (!appId) {
    mount.innerHTML = `
      <div class="empty-state card">
        <span class="material-symbols-outlined empty-state-icon">upload_file</span>
        <h2 class="empty-state-title">Choose an application first</h2>
        <p class="empty-state-text">Open an application that needs document replacement.</p>
        <a class="btn btn-primary" href="/citizen/my-applications.html">My Applications</a>
      </div>
    `;
    return;
  }

  const application = await getApplication(appId);
  const service = await getService(application?.serviceId);
  const requirements = service?.requirements?.length
    ? service.requirements
    : (application?.documents || []).map(doc => doc.name).filter(Boolean);
  const state = {
    application,
    requirements: requirements.length ? requirements : ['Valid ID', 'Supporting Document'],
    files: {}
  };
  renderUploadDocumentsPage(mount, state);
});

function renderUploadDocumentsPage(mount, state) {
  const existing = state.application?.documents || [];
  mount.innerHTML = `
    <form class="card" id="documentUploadForm">
      <div class="card-header">
        <div>
          <h2 class="card-title">${escapeHtml(state.application?.referenceNumber || 'Application Documents')}</h2>
          <p>${escapeHtml(state.application?.serviceName || 'Municipal Service')}</p>
        </div>
        ${renderStatusBadge(state.application?.status || 'submitted')}
      </div>
      <div class="card-body">
        <div class="grid-3">
          ${state.requirements.map(requirement => {
            const current = existing.find(doc => doc.name === requirement || doc.requirement === requirement);
            return `
              <label class="upload-zone">
                <input type="file" data-document="${escapeHtml(requirement)}" hidden accept="image/*,.pdf">
                <span class="material-symbols-outlined upload-zone-icon">${current?.url ? 'draft' : 'upload_file'}</span>
                <div class="upload-zone-text">${escapeHtml(requirement)}</div>
                <small data-upload-label="${escapeHtml(requirement)}">${current?.fileName || current?.name || 'Click to select replacement'}</small>
              </label>
            `;
          }).join('')}
        </div>
        ${state.application?.remarks ? `<div class="alert alert-warning mt-4"><span class="material-symbols-outlined">info</span><span>${escapeHtml(state.application.remarks)}</span></div>` : ''}
      </div>
      <div class="card-footer action-row">
        <button class="btn btn-primary"><span class="material-symbols-outlined">cloud_upload</span>Save Documents</button>
        <a class="btn btn-secondary" href="/citizen/application-details.html?id=${state.application?.id}">Back to Details</a>
      </div>
    </form>
  `;

  document.querySelectorAll('[data-document]').forEach(input => {
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      state.files[input.dataset.document] = file;
      document.querySelector(`[data-upload-label="${CSS.escape(input.dataset.document)}"]`).textContent = file.name;
    });
  });

  document.getElementById('documentUploadForm').addEventListener('submit', async event => {
    event.preventDefault();
    const selected = Object.entries(state.files);
    if (!selected.length) {
      showToast('Select at least one document to upload.', 'warning');
      return;
    }

    showLoader();
    try {
      const currentDocuments = [...(state.application.documents || [])];
      for (const [name, file] of selected) {
        const url = await uploadApplicationDocument(state.application.id, file, name);
        const payload = { name, fileName: file.name, size: file.size, url, uploadedAt: new Date() };
        const existingIndex = currentDocuments.findIndex(doc => doc.name === name || doc.requirement === name);
        if (existingIndex >= 0) currentDocuments[existingIndex] = { ...currentDocuments[existingIndex], ...payload };
        else currentDocuments.push(payload);
      }

      await updateApplicationDocuments(state.application.id, currentDocuments);
      if (state.application.status === 'rejected') {
        await updateApplicationStatus(state.application.id, 'documentVerification', 'Corrected documents resubmitted by citizen.');
      }
      showToast('Documents uploaded.', 'success');
      location.href = `/citizen/application-details.html?id=${state.application.id}`;
    } catch (error) {
      showToast(error.message || 'Unable to upload documents.', 'error');
    } finally {
      hideLoader();
    }
  });
}
