/* /assets/js/ui.js */
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer') || document.body;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span><button aria-label="Close" style="margin-left:auto;color:inherit;cursor:pointer">x</button>`;
  toast.querySelector('button').onclick = () => toast.remove();
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function showLoader() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.hidden = false;
}

function hideLoader() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.hidden = true;
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.hidden = true, 200);
  }
}

function confirmDialog(message, onConfirm) {
  let dialog = document.getElementById('confirmDialog');
  if (!dialog) {
    dialog = document.createElement('div');
    dialog.id = 'confirmDialog';
    dialog.className = 'modal-overlay';
    dialog.hidden = true;
    dialog.innerHTML = '<div class="modal"><div class="modal-header"><h2>Confirm Action</h2><button data-close="confirmDialog">x</button></div><div class="modal-body"><p id="confirmDialogMessage"></p></div><div class="modal-footer"><button class="btn btn-secondary" data-close="confirmDialog">Cancel</button><button class="btn btn-primary" id="confirmDialogOk">Confirm</button></div></div>';
    document.body.appendChild(dialog);
  }

  document.getElementById('confirmDialogMessage').textContent = message;
  document.getElementById('confirmDialogOk').onclick = () => {
    closeModal('confirmDialog');
    if (onConfirm) onConfirm();
  };
  openModal('confirmDialog');
}

function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const wrapper = document.getElementById('mainWrapper');
  if (!sidebar || !wrapper) return;

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.hidden = true;
  document.body.appendChild(overlay);

  if (localStorage.getItem('sidebarCollapsed') === 'true') {
    sidebar.classList.add('collapsed');
    wrapper.classList.add('collapsed');
  }

  function toggle() {
    if (innerWidth < 768) {
      sidebar.classList.toggle('open');
      overlay.hidden = !sidebar.classList.contains('open');
    } else {
      sidebar.classList.toggle('collapsed');
      wrapper.classList.toggle('collapsed');
      localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    }
  }

  ['sidebarToggle', 'topbarMenuBtn'].forEach(id => {
    const button = document.getElementById(id);
    if (button) button.onclick = toggle;
  });

  overlay.onclick = () => {
    sidebar.classList.remove('open');
    overlay.hidden = true;
  };
}

function setBreadcrumb(items) {
  const breadcrumb = document.getElementById('breadcrumb');
  if (!breadcrumb) return;
  breadcrumb.innerHTML = items.map((item, index) => (
    item.href && index < items.length - 1
      ? `<a href="${appPath(item.href)}">${escapeHtml(item.label)}</a><span>/</span>`
      : `<span>${escapeHtml(item.label)}</span>`
  )).join('');
}

function initThemeToggle() {
  const html = document.documentElement;
  const stored = localStorage.getItem('theme') || 'light';
  html.dataset.theme = stored === 'system' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : stored;

  const button = document.getElementById('themeToggle');
  if (button) {
    button.onclick = () => {
      const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
      html.dataset.theme = next;
      localStorage.setItem('theme', next);
    };
  }
}

function renderSkeleton(container, count = 3) {
  const element = typeof container === 'string' ? document.querySelector(container) : container;
  if (element) element.innerHTML = Array.from({ length: count }, () => '<div class="skeleton" style="height:96px"></div>').join('');
}

function initOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  const sync = () => banner.hidden = navigator.onLine;
  sync();
  addEventListener('online', sync);
  addEventListener('offline', sync);
}

document.addEventListener('click', event => {
  const closeButton = event.target.closest('[data-close]');
  if (closeButton) closeModal(closeButton.dataset.close);
});
