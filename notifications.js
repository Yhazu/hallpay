/* /assets/js/pages/notifications.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['citizen']);
  if (window.renderSidebar) await renderSidebar('citizen');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Citizen', href: '/citizen/dashboard.html' }, { label: 'Notifications' }]);

  const mount = document.querySelector('[data-page-module]');
  const notifications = await getUserNotifications(window.currentUser.uid);
  renderNotificationsPage(mount, notifications);
});

function notificationIcon(type) {
  return { success: 'check_circle', warning: 'notifications_active', error: 'error', info: 'info' }[type] || 'notifications';
}

function notificationClass(type) {
  return { success: 'alert-success', warning: 'alert-warning', error: 'alert-danger', info: 'alert-info' }[type] || 'alert-info';
}

function groupNotifications(notifications) {
  const today = new Date().toDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toDateString();
  return {
    Today: notifications.filter(item => toDate(item.createdAt).toDateString() === today),
    Yesterday: notifications.filter(item => toDate(item.createdAt).toDateString() === yesterday),
    Earlier: notifications.filter(item => ![today, yesterday].includes(toDate(item.createdAt).toDateString()))
  };
}

function renderNotificationsPage(mount, notifications) {
  const grouped = groupNotifications(notifications);
  mount.innerHTML = `
    <div class="card mb-4">
      <div class="card-body action-row">
        <button class="btn btn-secondary" id="markAllReadBtn">
          <span class="material-symbols-outlined">done_all</span>
          Mark All as Read
        </button>
        <span class="text-muted">${notifications.filter(item => !item.read).length} unread</span>
      </div>
    </div>
    ${notifications.length ? Object.entries(grouped).map(([group, items]) => items.length ? `
      <section class="card mb-4">
        <div class="card-header"><h2 class="card-title">${group}</h2></div>
        <div class="card-body notification-list">
          ${items.map(item => `
            <article class="notification-row ${item.read ? '' : 'is-unread'}" data-id="${item.id}" data-link="${item.deepLinkRoute || ''}">
              <div class="notification-icon ${notificationClass(item.type)}">
                <span class="material-symbols-outlined">${notificationIcon(item.type)}</span>
              </div>
              <div class="notification-content">
                <strong>${escapeHtml(item.title)}</strong>
                <p>${escapeHtml(item.body)}</p>
                <small>${formatRelativeTime(item.createdAt)}</small>
              </div>
              ${item.read ? '' : '<span class="notification-dot"></span>'}
            </article>
          `).join('')}
        </div>
      </section>
    ` : '').join('') : `
      <div class="empty-state card">
        <span class="material-symbols-outlined empty-state-icon">notifications_off</span>
        <h2 class="empty-state-title">No notifications</h2>
        <p class="empty-state-text">Application updates, payment reminders, and support replies will appear here.</p>
      </div>
    `}
  `;

  document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
    await markAllRead(window.currentUser.uid);
    notifications.forEach(item => item.read = true);
    showToast('All notifications marked as read.', 'success');
    renderNotificationsPage(mount, notifications);
  });

  document.querySelectorAll('.notification-row').forEach(row => {
    row.addEventListener('click', async () => {
      const notification = notifications.find(item => item.id === row.dataset.id);
      if (notification && !notification.read) {
        await markNotificationRead(notification.id);
        notification.read = true;
      }
      if (row.dataset.link) navigateTo(row.dataset.link);
      else renderNotificationsPage(mount, notifications);
    });
  });
}
