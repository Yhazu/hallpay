/* /assets/js/pages/user-details.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['admin']);
  if (window.renderSidebar) await renderSidebar('admin');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Admin', href: '/admin/dashboard.html' }, { label: 'Users', href: '/admin/users.html' }, { label: 'User Details' }]);

  const mount = document.querySelector('[data-page-module]');
  const uid = getQueryParam('id');
  const users = await getAllUsers();
  const user = users.find(item => (item.id || item.uid) === uid) || await getUser(uid);
  renderUserDetails(mount, user);
});

function renderUserDetails(mount, user) {
  if (!user) {
    mount.innerHTML = `<div class="empty-state card"><span class="material-symbols-outlined empty-state-icon">person_off</span><h2 class="empty-state-title">User not found</h2><a class="btn btn-primary" href="/admin/users.html">Back to Users</a></div>`;
    return;
  }

  mount.innerHTML = `
    <div class="profile-layout">
      <aside class="card">
        <div class="card-body profile-summary">
          <div class="profile-avatar">${escapeHtml((user.fullName || user.email || 'U').charAt(0).toUpperCase())}</div>
          <h2>${escapeHtml(user.fullName || 'Unnamed User')}</h2>
          <p>${escapeHtml(user.email || '')}</p>
          <p>${user.status === 'disabled' ? '<span class="badge badge-rejected">Disabled</span>' : '<span class="badge badge-approved">Active</span>'}</p>
        </div>
      </aside>
      <section class="profile-stack">
        <form class="card" id="userDetailsForm">
          <div class="card-header"><h2 class="card-title">Account Details</h2><button class="btn btn-primary btn-sm">Save</button></div>
          <div class="card-body">
            <div class="grid-2">
              <label class="form-group"><span class="form-label">Full Name</span><input class="form-control" name="fullName" value="${escapeHtml(user.fullName || '')}"></label>
              <label class="form-group"><span class="form-label">Email</span><input class="form-control" name="email" value="${escapeHtml(user.email || '')}" readonly></label>
              <label class="form-group"><span class="form-label">Phone</span><input class="form-control" name="phone" value="${escapeHtml(user.phone || '')}"></label>
              <label class="form-group"><span class="form-label">Role</span><select class="form-control" name="role">${['citizen','staff','treasurer','admin'].map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select></label>
              <label class="form-group"><span class="form-label">Status</span><select class="form-control" name="status"><option value="active" ${user.status !== 'disabled' ? 'selected' : ''}>active</option><option value="disabled" ${user.status === 'disabled' ? 'selected' : ''}>disabled</option></select></label>
              <label class="form-group"><span class="form-label">Address</span><textarea class="form-control" name="address">${escapeHtml(user.address || '')}</textarea></label>
            </div>
          </div>
        </form>
        <div class="card">
          <div class="card-header"><h2 class="card-title">Audit Summary</h2></div>
          <div class="card-body">
            <p><strong>User ID:</strong> ${escapeHtml(user.id || user.uid || '')}</p>
            <p><strong>Joined:</strong> ${formatDate(user.createdAt || new Date())}</p>
            <p><strong>Verified:</strong> ${user.isVerified ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </section>
    </div>
  `;

  document.getElementById('userDetailsForm').addEventListener('submit', async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await updateUser(user.id || user.uid, data);
    showToast('User details updated.', 'success');
  });
}
