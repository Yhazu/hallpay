/* /assets/js/pages/users.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['admin']);
  if (window.renderSidebar) await renderSidebar('admin');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Admin', href: '/admin/dashboard.html' }, { label: 'Users' }]);

  const mount = document.querySelector('[data-page-module]');
  const state = { users: await getAllUsers(), query: '', role: 'All' };
  renderUsersPage(mount, state);
});

function filteredUsers(state) {
  const query = state.query.trim().toLowerCase();
  return state.users
    .filter(user => state.role === 'All' || user.role === state.role.toLowerCase())
    .filter(user => !query || [user.fullName, user.email, user.role, user.status].some(value => String(value || '').toLowerCase().includes(query)))
    .sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
}

function renderUsersPage(mount, state) {
  const users = filteredUsers(state);
  mount.innerHTML = `
    <div class="card mb-4">
      <div class="card-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <span class="material-symbols-outlined">search</span>
            <input class="form-control search-input" id="userSearch" value="${escapeHtml(state.query)}" placeholder="Search name, email, or role">
          </div>
          <select class="form-control" id="roleFilter">
            ${['All', 'Citizen', 'Staff', 'Treasurer', 'Admin'].map(role => `<option ${state.role === role ? 'selected' : ''}>${role}</option>`).join('')}
          </select>
          <button class="btn btn-secondary" id="refreshUsersBtn"><span class="material-symbols-outlined">refresh</span>Refresh</button>
        </div>
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td><strong>${escapeHtml(user.fullName || 'Unnamed User')}</strong></td>
              <td>${escapeHtml(user.email || '')}</td>
              <td>
                <select class="form-control table-select" data-role-user="${user.id || user.uid}">
                  ${['citizen', 'staff', 'treasurer', 'admin'].map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role}</option>`).join('')}
                </select>
              </td>
              <td>${user.status === 'disabled' ? '<span class="badge badge-rejected">Disabled</span>' : '<span class="badge badge-approved">Active</span>'}</td>
              <td>${formatDate(user.createdAt || new Date())}</td>
              <td>
                <div class="table-actions">
                  <a class="btn btn-sm btn-secondary" href="/admin/user-details.html?id=${user.id || user.uid}">View</a>
                  <button class="btn btn-sm ${user.status === 'disabled' ? 'btn-success' : 'btn-warning'}" data-toggle-user="${user.id || user.uid}" data-status="${user.status || 'active'}">${user.status === 'disabled' ? 'Enable' : 'Disable'}</button>
                </div>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="6">No users found.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('userSearch').addEventListener('input', debounce(event => {
    state.query = event.target.value;
    renderUsersPage(mount, state);
  }, 150));
  document.getElementById('roleFilter').addEventListener('change', event => {
    state.role = event.target.value;
    renderUsersPage(mount, state);
  });
  document.getElementById('refreshUsersBtn').addEventListener('click', async () => {
    state.users = await getAllUsers();
    renderUsersPage(mount, state);
  });
  document.querySelectorAll('[data-role-user]').forEach(select => {
    select.addEventListener('change', async () => {
      await updateUser(select.dataset.roleUser, { role: select.value });
      const user = state.users.find(item => (item.id || item.uid) === select.dataset.roleUser);
      if (user) user.role = select.value;
      showToast('User role updated.', 'success');
      await renderSidebar('admin');
    });
  });
  document.querySelectorAll('[data-toggle-user]').forEach(button => {
    button.addEventListener('click', async () => {
      const nextStatus = button.dataset.status === 'disabled' ? 'active' : 'disabled';
      await updateUser(button.dataset.toggleUser, { status: nextStatus });
      const user = state.users.find(item => (item.id || item.uid) === button.dataset.toggleUser);
      if (user) user.status = nextStatus;
      showToast(`User ${nextStatus === 'disabled' ? 'disabled' : 'enabled'}.`, 'success');
      renderUsersPage(mount, state);
    });
  });
}
