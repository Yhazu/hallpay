/* /assets/js/pages/announcements.js */
document.addEventListener('DOMContentLoaded', async () => {
  const role = document.body.dataset.role || 'citizen';
  await requireAuth([role]);
  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: role.charAt(0).toUpperCase() + role.slice(1), href: `/${role}/dashboard.html` }, { label: 'Announcements' }]);

  const mount = document.querySelector('[data-page-module]');
  const state = {
    announcements: role === 'admin' && window.getAllAnnouncements ? await getAllAnnouncements() : await getAnnouncements(),
    category: 'All',
    status: 'All',
    query: ''
  };

  if (role === 'admin') {
    renderAdminAnnouncementsPage(mount, state);
    return;
  }

  renderAnnouncementsPage(mount, state);
});

function filteredAnnouncements(state) {
  const query = state.query.trim().toLowerCase();
  return state.announcements
    .filter(item => state.category === 'All' || item.category === state.category)
    .filter(item => !query || [item.title, item.content, item.category].some(value => String(value || '').toLowerCase().includes(query)))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || toDate(b.publishedAt) - toDate(a.publishedAt));
}

function renderAnnouncementsPage(mount, state) {
  const categories = ['All', ...new Set(state.announcements.map(item => item.category || 'Advisory'))];
  const items = filteredAnnouncements(state);

  mount.innerHTML = `
    <div class="card mb-4">
      <div class="card-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <span class="material-symbols-outlined">search</span>
            <input class="form-control search-input" id="announcementSearch" value="${escapeHtml(state.query)}" placeholder="Search announcements">
          </div>
          <div class="filter-chips">
            ${categories.map(category => `<button class="chip ${state.category === category ? 'active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>
    ${items.length ? `
      <div class="grid-3 announcement-grid">
        ${items.map(item => `
          <article class="announcement-card announcement-card-full ${item.category === 'Emergency' ? 'is-emergency' : ''}">
            <div class="announcement-card-meta">
              <span class="badge ${item.category === 'Emergency' ? 'badge-rejected' : item.category === 'Deadline' ? 'badge-pay-pending' : 'badge-submitted'}">${escapeHtml(item.category || 'Advisory')}</span>
              ${item.pinned ? '<span class="badge badge-ready">Pinned</span>' : ''}
            </div>
            <h2>${escapeHtml(item.title)}</h2>
            <small>${formatDate(item.publishedAt || item.createdAt)}</small>
            <p data-preview>${escapeHtml(truncate(item.content || '', 180))}</p>
            <button class="btn btn-sm btn-secondary" data-read-more>Read More</button>
            <template>${escapeHtml(item.content || '')}</template>
          </article>
        `).join('')}
      </div>
    ` : `
      <div class="empty-state card">
        <span class="material-symbols-outlined empty-state-icon">campaign</span>
        <h2 class="empty-state-title">No announcements found</h2>
        <p class="empty-state-text">Try another category or search term.</p>
      </div>
    `}
  `;

  document.getElementById('announcementSearch')?.addEventListener('input', debounce(event => {
    state.query = event.target.value;
    renderAnnouncementsPage(mount, state);
  }, 150));

  document.querySelectorAll('[data-category]').forEach(button => {
    button.addEventListener('click', () => {
      state.category = button.dataset.category;
      renderAnnouncementsPage(mount, state);
    });
  });

  document.querySelectorAll('[data-read-more]').forEach(button => {
    button.addEventListener('click', () => {
      const card = button.closest('.announcement-card');
      const preview = card.querySelector('[data-preview]');
      const full = card.querySelector('template').innerHTML;
      const expanded = button.dataset.expanded === 'true';
      preview.textContent = expanded ? truncate(full, 180) : full;
      button.textContent = expanded ? 'Read More' : 'Show Less';
      button.dataset.expanded = String(!expanded);
    });
  });
}

function renderAdminAnnouncementsPage(mount, state) {
  const items = filteredAdminAnnouncements(state);
  const categories = ['All', 'Advisory', 'Deadline', 'Emergency'];
  const statuses = ['All', 'published', 'draft', 'archived'];

  mount.innerHTML = `
    <div class="stats-grid">
      ${announcementStat('campaign', 'Published', state.announcements.filter(item => adminAnnouncementStatus(item) === 'published').length)}
      ${announcementStat('edit_note', 'Drafts', state.announcements.filter(item => adminAnnouncementStatus(item) === 'draft').length)}
      ${announcementStat('priority_high', 'Emergency', state.announcements.filter(item => item.category === 'Emergency').length)}
      ${announcementStat('push_pin', 'Pinned', state.announcements.filter(item => item.pinned).length)}
    </div>

    <div class="card mb-4">
      <div class="card-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <span class="material-symbols-outlined">search</span>
            <input class="form-control search-input" id="adminAnnouncementSearch" value="${escapeHtml(state.query)}" placeholder="Search title, content, or category">
          </div>
          <select class="form-control table-select" id="adminAnnouncementCategory" aria-label="Filter category">
            ${categories.map(category => `<option value="${category}" ${state.category === category ? 'selected' : ''}>${category}</option>`).join('')}
          </select>
          <select class="form-control table-select" id="adminAnnouncementStatus" aria-label="Filter status">
            ${statuses.map(status => `<option value="${status}" ${state.status === status ? 'selected' : ''}>${status === 'All' ? 'All Statuses' : statusLabel(status)}</option>`).join('')}
          </select>
          <button class="btn btn-primary" id="newAnnouncementBtn"><span class="material-symbols-outlined">add</span>New Announcement</button>
        </div>
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Pinned</th><th>Published</th><th>Expires</th><th>Actions</th></tr></thead>
        <tbody>
          ${items.map(item => `
            <tr>
              <td>
                <strong>${escapeHtml(item.title)}</strong>
                <p class="table-muted">${escapeHtml(truncate(item.content || '', 88))}</p>
              </td>
              <td>${announcementCategoryBadge(item.category)}</td>
              <td>${announcementStatusBadge(item)}</td>
              <td>${item.pinned ? '<span class="badge badge-ready">Pinned</span>' : '<span class="badge badge-draft">No</span>'}</td>
              <td>${item.publishedAt ? formatDate(item.publishedAt) : 'Not published'}</td>
              <td>${item.expiresAt ? formatDate(item.expiresAt) : 'No expiry'}</td>
              <td>
                <div class="table-actions">
                  <button class="btn btn-sm btn-secondary" data-preview-announcement="${item.id}"><span class="material-symbols-outlined">visibility</span>View</button>
                  <button class="btn btn-sm btn-secondary" data-edit-announcement="${item.id}"><span class="material-symbols-outlined">edit</span>Edit</button>
                  <button class="btn btn-sm ${adminAnnouncementStatus(item) === 'published' ? 'btn-warning' : 'btn-success'}" data-status-announcement="${item.id}">
                    <span class="material-symbols-outlined">${adminAnnouncementStatus(item) === 'published' ? 'archive' : 'publish'}</span>${adminAnnouncementStatus(item) === 'published' ? 'Archive' : 'Publish'}
                  </button>
                  <button class="btn btn-sm btn-danger" data-delete-announcement="${item.id}"><span class="material-symbols-outlined">delete</span>Delete</button>
                </div>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="7">No announcements found.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="modal-overlay" id="announcementFormModal" hidden>
      <div class="modal modal-wide">
        <div class="modal-header"><h2 class="modal-title" id="announcementFormTitle">New Announcement</h2><button class="modal-close" data-close="announcementFormModal"><span class="material-symbols-outlined">close</span></button></div>
        <form id="announcementForm">
          <div class="modal-body">
            <label class="form-group"><span class="form-label required">Title</span><input class="form-control" name="title" required></label>
            <div class="grid-2">
              <label class="form-group"><span class="form-label required">Category</span><select class="form-control" name="category"><option>Advisory</option><option>Deadline</option><option>Emergency</option></select></label>
              <label class="form-group"><span class="form-label required">Status</span><select class="form-control" name="status"><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
            </div>
            <label class="form-group"><span class="form-label required">Content</span><textarea class="form-control" name="content" rows="8" required minlength="20"></textarea><small class="form-hint">Minimum 20 characters. This is what citizens will see.</small></label>
            <div class="grid-2">
              <label class="form-group"><span class="form-label">Expiry date</span><input class="form-control" type="date" name="expiresAt"><small class="form-hint">Leave blank if it should not expire.</small></label>
              <label class="switch"><span>Pin to top</span><input type="checkbox" name="pinned"></label>
            </div>
          </div>
          <div class="modal-footer"><button class="btn btn-secondary" type="button" data-close="announcementFormModal">Cancel</button><button class="btn btn-primary">Save Announcement</button></div>
        </form>
      </div>
    </div>

    <div class="modal-overlay" id="announcementPreviewModal" hidden>
      <div class="modal modal-wide">
        <div class="modal-header"><h2 class="modal-title">Announcement Preview</h2><button class="modal-close" data-close="announcementPreviewModal"><span class="material-symbols-outlined">close</span></button></div>
        <div class="modal-body" id="announcementPreviewBody"></div>
        <div class="modal-footer"><button class="btn btn-secondary" data-close="announcementPreviewModal">Close</button></div>
      </div>
    </div>
  `;

  document.getElementById('adminAnnouncementSearch').addEventListener('input', debounce(event => {
    state.query = event.target.value;
    renderAdminAnnouncementsPage(mount, state);
  }, 150));

  document.getElementById('adminAnnouncementCategory').addEventListener('change', event => {
    state.category = event.target.value;
    renderAdminAnnouncementsPage(mount, state);
  });

  document.getElementById('adminAnnouncementStatus').addEventListener('change', event => {
    state.status = event.target.value;
    renderAdminAnnouncementsPage(mount, state);
  });

  document.getElementById('newAnnouncementBtn').addEventListener('click', () => {
    const form = document.getElementById('announcementForm');
    form.reset();
    delete form.dataset.editing;
    document.getElementById('announcementFormTitle').textContent = 'New Announcement';
    openModal('announcementFormModal');
  });

  document.querySelectorAll('[data-preview-announcement]').forEach(button => {
    button.addEventListener('click', () => {
      const item = state.announcements.find(announcement => announcement.id === button.dataset.previewAnnouncement);
      document.getElementById('announcementPreviewBody').innerHTML = renderAnnouncementPreview(item);
      openModal('announcementPreviewModal');
    });
  });

  document.querySelectorAll('[data-edit-announcement]').forEach(button => {
    button.addEventListener('click', () => {
      const item = state.announcements.find(announcement => announcement.id === button.dataset.editAnnouncement);
      const form = document.getElementById('announcementForm');
      form.title.value = item.title || '';
      form.category.value = item.category || 'Advisory';
      form.status.value = item.status || 'published';
      form.content.value = item.content || '';
      form.pinned.checked = Boolean(item.pinned);
      form.expiresAt.value = item.expiresAt ? toDate(item.expiresAt).toISOString().slice(0, 10) : '';
      form.dataset.editing = item.id;
      document.getElementById('announcementFormTitle').textContent = 'Edit Announcement';
      openModal('announcementFormModal');
    });
  });

  document.querySelectorAll('[data-status-announcement]').forEach(button => {
    button.addEventListener('click', async () => {
      const item = state.announcements.find(announcement => announcement.id === button.dataset.statusAnnouncement);
      const nextStatus = adminAnnouncementStatus(item) === 'published' ? 'archived' : 'published';
      await saveAnnouncementStatus(state, item, nextStatus);
      renderAdminAnnouncementsPage(mount, state);
    });
  });

  document.querySelectorAll('[data-delete-announcement]').forEach(button => {
    button.addEventListener('click', () => {
      const item = state.announcements.find(announcement => announcement.id === button.dataset.deleteAnnouncement);
      confirmDialog(`Delete "${item.title}"? Citizens will no longer see this announcement.`, async () => {
        await deleteAdminAnnouncement(state, item.id);
        renderAdminAnnouncementsPage(mount, state);
      });
    });
  });

  document.getElementById('announcementForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const payload = {
      id: form.dataset.editing || `ann-${Date.now()}`,
      title: data.title,
      category: data.category,
      content: data.content,
      status: data.status || 'published',
      pinned: form.pinned.checked,
      expiresAt: data.expiresAt ? new Date(`${data.expiresAt}T23:59:59`) : null,
      publishedAt: data.status === 'draft' ? null : new Date(),
      updatedAt: new Date()
    };
    await saveAdminAnnouncement(state, payload, form.dataset.editing);
    closeModal('announcementFormModal');
    renderAdminAnnouncementsPage(mount, state);
  });
}

function filteredAdminAnnouncements(state) {
  const query = state.query.trim().toLowerCase();
  return state.announcements
    .filter(item => state.category === 'All' || item.category === state.category)
    .filter(item => state.status === 'All' || adminAnnouncementStatus(item) === state.status)
    .filter(item => !query || [item.title, item.content, item.category, item.status].some(value => String(value || '').toLowerCase().includes(query)))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || toDate(b.updatedAt || b.publishedAt || b.createdAt) - toDate(a.updatedAt || a.publishedAt || a.createdAt));
}

function announcementStat(icon, label, value) {
  return `
    <div class="stat-card">
      <div class="stat-card-icon"><span class="material-symbols-outlined">${icon}</span></div>
      <div><div class="stat-card-value">${value}</div><div class="stat-card-label">${label}</div></div>
    </div>
  `;
}

function statusLabel(status) {
  return String(status || 'published').replace(/^\w/, char => char.toUpperCase());
}

function adminAnnouncementStatus(item) {
  if (item.status === 'archived' || item.status === 'draft') return item.status;
  if (item.expiresAt && toDate(item.expiresAt) < new Date()) return 'archived';
  return 'published';
}

function announcementStatusBadge(item) {
  const status = adminAnnouncementStatus(item);
  const classes = { published: 'badge-approved', draft: 'badge-draft', archived: 'badge-rejected' };
  return `<span class="badge ${classes[status] || 'badge-submitted'}">${statusLabel(status)}</span>`;
}

function announcementCategoryBadge(category = 'Advisory') {
  const classes = { Advisory: 'badge-submitted', Deadline: 'badge-pay-pending', Emergency: 'badge-rejected' };
  return `<span class="badge ${classes[category] || 'badge-submitted'}">${escapeHtml(category)}</span>`;
}

function renderAnnouncementPreview(item) {
  if (!item) return '<p>Announcement not found.</p>';
  return `
    <article class="announcement-card-full ${item.category === 'Emergency' ? 'is-emergency' : ''}">
      <div class="announcement-card-meta">
        ${announcementCategoryBadge(item.category)}
        ${announcementStatusBadge(item)}
        ${item.pinned ? '<span class="badge badge-ready">Pinned</span>' : ''}
      </div>
      <h2>${escapeHtml(item.title)}</h2>
      <small>${item.publishedAt ? formatDate(item.publishedAt) : 'Not published yet'}${item.expiresAt ? ` • Expires ${formatDate(item.expiresAt)}` : ''}</small>
      <p>${escapeHtml(item.content || '')}</p>
    </article>
  `;
}

async function saveAdminAnnouncement(state, payload, editingId) {
  showLoader();
  try {
    if (editingId && window.updateAnnouncement) {
      await updateAnnouncement(editingId, payload);
    } else if (!editingId && window.createAnnouncement) {
      payload.id = await createAnnouncement(payload);
    }

    const existing = state.announcements.findIndex(item => item.id === payload.id);
    if (existing >= 0) state.announcements[existing] = { ...state.announcements[existing], ...payload };
    else state.announcements.unshift({ ...payload, createdAt: new Date() });
    showToast('Announcement saved.', 'success');
  } catch (error) {
    showToast(error.message || 'Unable to save announcement.', 'error');
  } finally {
    hideLoader();
  }
}

async function saveAnnouncementStatus(state, item, nextStatus) {
  showLoader();
  try {
    const patch = { status: nextStatus, publishedAt: nextStatus === 'published' ? new Date() : item.publishedAt || null };
    if (window.updateAnnouncement) await updateAnnouncement(item.id, patch);
    Object.assign(item, patch, { updatedAt: new Date() });
    showToast(`Announcement ${nextStatus === 'published' ? 'published' : 'archived'}.`, 'success');
  } catch (error) {
    showToast(error.message || 'Unable to update announcement.', 'error');
  } finally {
    hideLoader();
  }
}

async function deleteAdminAnnouncement(state, announcementId) {
  showLoader();
  try {
    if (window.deleteAnnouncement) await deleteAnnouncement(announcementId);
    state.announcements = state.announcements.filter(item => item.id !== announcementId);
    showToast('Announcement deleted.', 'success');
  } catch (error) {
    showToast(error.message || 'Unable to delete announcement.', 'error');
  } finally {
    hideLoader();
  }
}
