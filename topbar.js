/* /assets/js/components/topbar.js */
function renderTopbar(user = window.currentUser || demoUser) {
  const name = document.getElementById('topbarUsername');
  const avatar = document.getElementById('topbarAvatar');
  const button = document.getElementById('topbarAvatarBtn');
  const menu = document.getElementById('userDropdown');
  const role = user.role || document.body.dataset.role || 'citizen';
  const roleLinks = {
    citizen: [
      { href: '/citizen/profile.html', icon: 'person', label: 'My Profile' },
      { href: '/citizen/settings.html', icon: 'settings', label: 'Settings' }
    ],
    staff: [
      { href: '/staff/dashboard.html', icon: 'space_dashboard', label: 'Workspace' }
    ],
    treasurer: [
      { href: '/treasurer/dashboard.html', icon: 'space_dashboard', label: 'Workspace' }
    ],
    admin: [
      { href: '/admin/dashboard.html', icon: 'space_dashboard', label: 'Workspace' },
      { href: '/admin/settings.html', icon: 'settings', label: 'Settings' }
    ]
  };

  if (name) name.textContent = user.fullName || user.email || 'User';
  if (avatar) avatar.textContent = (user.fullName || user.email || 'U').charAt(0).toUpperCase();

  if (menu) {
    const links = roleLinks[role] || roleLinks.citizen;
    menu.innerHTML = `
      ${links.map(link => `
        <a href="${link.href}" class="dropdown-item">
          <span class="material-symbols-outlined">${link.icon}</span> ${link.label}
        </a>
      `).join('')}
      <div class="dropdown-divider"></div>
      <button class="dropdown-item dropdown-item--danger" id="logoutBtn" type="button">
        <span class="material-symbols-outlined">logout</span> Sign Out
      </button>
    `;
    const logoutBtn = menu.querySelector('#logoutBtn');
    if (logoutBtn) logoutBtn.onclick = logout;
  }

  if (button && menu) {
    button.onclick = event => {
      event.stopPropagation();
      menu.hidden = !menu.hidden;
    };
  }

  if (!window.__hallPayTopbarOutsideCloseBound) {
    window.__hallPayTopbarOutsideCloseBound = true;
    document.addEventListener('click', event => {
      const activeMenu = document.getElementById('userDropdown');
      if (!activeMenu || activeMenu.hidden) return;
      if (!event.target.closest('#topbarUserMenu')) activeMenu.hidden = true;
    });
  }

  const notifBtn = document.getElementById('notifBtn');
  if (notifBtn) {
    notifBtn.hidden = false;
    notifBtn.disabled = false;
    notifBtn.type = 'button';
    notifBtn.title = role === 'citizen' ? 'Notifications' : 'No new notifications';
    notifBtn.onclick = event => {
      event.preventDefault();
      event.stopPropagation();

      if (role === 'citizen') {
        navigateTo('/citizen/notifications.html');
        return;
      }

      if (typeof showToast === 'function') {
        showToast('No notifications for this workspace yet.', 'info');
      }
    };
  }

  const badge = document.getElementById('notifBadge');
  if (badge) {
    badge.hidden = true;
    if (role === 'citizen' && user.uid && typeof getUserNotifications === 'function') {
      getUserNotifications(user.uid).then(notifications => {
        const unread = notifications.filter(notification => !notification.read).length;
        badge.textContent = unread;
        badge.hidden = unread === 0;
      }).catch(() => {
        badge.hidden = true;
      });
    }
  }
}
