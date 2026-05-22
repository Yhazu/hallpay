/* /assets/js/pages/my-applications.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['citizen']);
  if (window.renderSidebar) await renderSidebar('citizen');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Citizen', href: '/citizen/dashboard.html' }, { label: 'My Applications' }]);

  const mount = document.querySelector('[data-page-module]');
  const state = {
    applications: [],
    query: '',
    status: 'All',
    page: 1,
    perPage: 10
  };

  try {
    renderSkeleton(mount, 4);
    state.applications = await getUserApplications(window.currentUser.uid);
    renderMyApplications(mount, state);
  } catch (error) {
    mount.innerHTML = `
      <div class="alert alert-danger">
        <span class="material-symbols-outlined">error</span>
        ${escapeHtml(error.message)}
      </div>
    `;
  }
});

function applicationMatchesStatus(application, status) {
  if (status === 'All') return true;
  if (status === 'Draft') return application.status === 'draft';
  if (status === 'Pending') return ['submitted', 'underReview', 'documentVerification', 'forAssessment', 'forPayment', 'paymentPending'].includes(application.status);
  if (status === 'Approved') return ['approved', 'readyForRelease'].includes(application.status);
  if (status === 'Rejected') return application.status === 'rejected';
  if (status === 'Completed') return application.status === 'completed';
  return true;
}

function getFilteredApplications(state) {
  const query = state.query.trim().toLowerCase();
  return state.applications
    .filter(application => applicationMatchesStatus(application, state.status))
    .filter(application => {
      if (!query) return true;
      return [
        application.referenceNumber,
        application.serviceName,
        statusLabels[application.status],
        application.status
      ].some(value => String(value || '').toLowerCase().includes(query));
    })
    .sort((a, b) => toDate(b.updatedAt || b.createdAt) - toDate(a.updatedAt || a.createdAt));
}

function renderApplicationActions(application) {
  const actions = [`<a class="btn btn-sm btn-secondary" href="/citizen/application-details.html?id=${application.id}">View</a>`];
  if (application.status === 'forPayment') {
    actions.push(`<a class="btn btn-sm btn-primary" href="/citizen/payment.html?appId=${application.id}">Pay</a>`);
  }
  if (['paid', 'approved', 'readyForRelease', 'completed'].includes(application.status)) {
    actions.push(`<a class="btn btn-sm btn-secondary" href="/citizen/receipt-viewer.html?appId=${application.id}">Receipt</a>`);
  }
  if (['approved', 'readyForRelease', 'completed'].includes(application.status)) {
    actions.push(`<a class="btn btn-sm btn-secondary" href="/citizen/permit-viewer.html?appId=${application.id}">Permit</a>`);
  }
  if (application.status === 'rejected') {
    actions.push(`<a class="btn btn-sm btn-warning" href="/citizen/upload-documents.html?id=${application.id}">Resubmit</a>`);
  }
  return actions.join('');
}

function renderMyApplications(mount, state) {
  const filtered = getFilteredApplications(state);
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.perPage));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.perPage;
  const pageItems = filtered.slice(start, start + state.perPage);

  mount.innerHTML = `
    <div class="card mb-4">
      <div class="card-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <span class="material-symbols-outlined">search</span>
            <input class="form-control search-input" id="applicationSearch" value="${escapeHtml(state.query)}" placeholder="Search by reference, service, or status">
          </div>
          <div class="filter-chips">
            ${['All', 'Draft', 'Pending', 'Approved', 'Rejected', 'Completed'].map(status => `
              <button class="chip ${state.status === status ? 'active' : ''}" data-status="${status}">${status}</button>
            `).join('')}
          </div>
          <a class="btn btn-primary" href="/citizen/apply.html">
            <span class="material-symbols-outlined">add</span>
            New Application
          </a>
        </div>
      </div>
    </div>

    ${filtered.length ? `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Reference #</th>
              <th>Service</th>
              <th>Status</th>
              <th>Date Submitted</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.map(application => `
              <tr>
                <td><strong>${escapeHtml(application.referenceNumber || application.id)}</strong></td>
                <td>${escapeHtml(application.serviceName || 'Municipal Service')}</td>
                <td>${renderStatusBadge(application.status || 'submitted')}</td>
                <td>${formatDate(application.createdAt)}</td>
                <td>${formatDate(application.updatedAt || application.createdAt)}</td>
                <td><div class="table-actions">${renderApplicationActions(application)}</div></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="pagination">
          <span class="pagination-info">Showing ${start + 1}-${Math.min(start + state.perPage, filtered.length)} of ${filtered.length}</span>
          <div class="pagination-btns">
            <button class="pagination-btn" id="prevPageBtn" ${state.page === 1 ? 'disabled' : ''}>Previous</button>
            ${Array.from({ length: totalPages }, (_, index) => `
              <button class="pagination-btn ${state.page === index + 1 ? 'active' : ''}" data-page="${index + 1}">${index + 1}</button>
            `).join('')}
            <button class="pagination-btn" id="nextPageBtn" ${state.page === totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      </div>
    ` : `
      <div class="empty-state card">
        <span class="material-symbols-outlined empty-state-icon">assignment</span>
        <h2 class="empty-state-title">No applications found</h2>
        <p class="empty-state-text">${state.applications.length ? 'Try a different search or status filter.' : 'No applications yet. Apply for a service to get started.'}</p>
        <a class="btn btn-primary" href="/citizen/services.html">Browse Services</a>
      </div>
    `}
  `;

  document.getElementById('applicationSearch')?.addEventListener('input', debounce(event => {
    state.query = event.target.value;
    state.page = 1;
    renderMyApplications(mount, state);
  }, 150));

  document.querySelectorAll('[data-status]').forEach(button => {
    button.addEventListener('click', () => {
      state.status = button.dataset.status;
      state.page = 1;
      renderMyApplications(mount, state);
    });
  });

  document.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => {
      state.page = Number(button.dataset.page);
      renderMyApplications(mount, state);
    });
  });

  document.getElementById('prevPageBtn')?.addEventListener('click', () => {
    state.page -= 1;
    renderMyApplications(mount, state);
  });

  document.getElementById('nextPageBtn')?.addEventListener('click', () => {
    state.page += 1;
    renderMyApplications(mount, state);
  });
}
