/* /assets/js/pages/announcement-form.js */
document.addEventListener('DOMContentLoaded', async () => {
  const role = document.body.dataset.role || 'admin';
  await requireAuth([role]);
  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([
    { label: 'Admin', href: '/admin/dashboard.html' },
    { label: 'Announcements', href: '/admin/announcements.html' },
    { label: getQueryParam('id') ? 'Edit' : 'New' }
  ]);

  const mount = document.querySelector('[data-page-module]');
  const announcementId = getQueryParam('id');
  const announcements = window.getAllAnnouncements ? await getAllAnnouncements() : await getAnnouncements();
  const announcement = announcementId ? announcements.find(item => item.id === announcementId) : null;

  mount.innerHTML = `
    <form class="card" id="standaloneAnnouncementForm">
      <div class="card-header">
        <h2 class="card-title">${announcement ? 'Edit Announcement' : 'Create Announcement'}</h2>
        <a class="btn btn-secondary" href="/admin/announcements.html"><span class="material-symbols-outlined">arrow_back</span>Back</a>
      </div>
      <div class="card-body">
        <label class="form-group">
          <span class="form-label required">Title</span>
          <input class="form-control" name="title" value="${escapeHtml(announcement?.title || '')}" required>
        </label>
        <div class="grid-2">
          <label class="form-group">
            <span class="form-label required">Category</span>
            <select class="form-control" name="category">
              ${['Advisory', 'Deadline', 'Emergency'].map(category => `<option ${category === (announcement?.category || 'Advisory') ? 'selected' : ''}>${category}</option>`).join('')}
            </select>
          </label>
          <label class="form-group">
            <span class="form-label required">Status</span>
            <select class="form-control" name="status">
              ${['published', 'draft', 'archived'].map(status => `<option value="${status}" ${status === (announcement?.status || 'published') ? 'selected' : ''}>${status.replace(/^\w/, char => char.toUpperCase())}</option>`).join('')}
            </select>
          </label>
        </div>
        <label class="form-group">
          <span class="form-label required">Content</span>
          <textarea class="form-control" name="content" rows="10" required minlength="20">${escapeHtml(announcement?.content || '')}</textarea>
          <small class="form-hint">Minimum 20 characters.</small>
        </label>
        <div class="grid-2">
          <label class="form-group">
            <span class="form-label">Expiry date</span>
            <input class="form-control" type="date" name="expiresAt" value="${announcement?.expiresAt ? toDate(announcement.expiresAt).toISOString().slice(0, 10) : ''}">
          </label>
          <label class="switch">
            <span>Pin to top</span>
            <input type="checkbox" name="pinned" ${announcement?.pinned ? 'checked' : ''}>
          </label>
        </div>
      </div>
      <div class="card-footer action-row">
        <button class="btn btn-primary" type="submit"><span class="material-symbols-outlined">save</span>Save Announcement</button>
        <button class="btn btn-secondary" type="button" id="previewBtn"><span class="material-symbols-outlined">visibility</span>Preview</button>
      </div>
    </form>

    <div class="modal-overlay" id="standalonePreviewModal" hidden>
      <div class="modal modal-wide">
        <div class="modal-header"><h2 class="modal-title">Preview</h2><button class="modal-close" data-close="standalonePreviewModal"><span class="material-symbols-outlined">close</span></button></div>
        <div class="modal-body" id="standalonePreviewBody"></div>
        <div class="modal-footer"><button class="btn btn-secondary" data-close="standalonePreviewModal">Close</button></div>
      </div>
    </div>
  `;

  const form = document.getElementById('standaloneAnnouncementForm');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = announcementPayloadFromForm(form, announcement?.id);
    showLoader();
    try {
      if (announcement?.id && window.updateAnnouncement) await updateAnnouncement(announcement.id, payload);
      if (!announcement?.id && window.createAnnouncement) await createAnnouncement(payload);
      showToast('Announcement saved.', 'success');
      location.href = '/admin/announcements.html';
    } catch (error) {
      showToast(error.message || 'Unable to save announcement.', 'error');
    } finally {
      hideLoader();
    }
  });

  document.getElementById('previewBtn').addEventListener('click', () => {
    const payload = announcementPayloadFromForm(form, announcement?.id);
    document.getElementById('standalonePreviewBody').innerHTML = `
      <article class="announcement-card-full ${payload.category === 'Emergency' ? 'is-emergency' : ''}">
        <div class="announcement-card-meta">
          <span class="badge ${payload.category === 'Emergency' ? 'badge-rejected' : payload.category === 'Deadline' ? 'badge-pay-pending' : 'badge-submitted'}">${escapeHtml(payload.category)}</span>
          <span class="badge ${payload.status === 'published' ? 'badge-approved' : payload.status === 'draft' ? 'badge-draft' : 'badge-rejected'}">${escapeHtml(payload.status)}</span>
          ${payload.pinned ? '<span class="badge badge-ready">Pinned</span>' : ''}
        </div>
        <h2>${escapeHtml(payload.title)}</h2>
        <small>${payload.expiresAt ? `Expires ${formatDate(payload.expiresAt)}` : 'No expiry'}</small>
        <p>${escapeHtml(payload.content)}</p>
      </article>
    `;
    openModal('standalonePreviewModal');
  });
});

function announcementPayloadFromForm(form, id = null) {
  const data = Object.fromEntries(new FormData(form));
  return {
    id: id || `ann-${Date.now()}`,
    title: data.title,
    category: data.category,
    status: data.status,
    content: data.content,
    pinned: form.pinned.checked,
    expiresAt: data.expiresAt ? new Date(`${data.expiresAt}T23:59:59`) : null,
    publishedAt: data.status === 'draft' ? null : new Date(),
    updatedAt: new Date()
  };
}
