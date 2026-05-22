/* /assets/js/pages/services.js */
document.addEventListener('DOMContentLoaded', async () => {
  const role = document.body.dataset.role || 'citizen';
  await requireAuth([role]);
  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();

  const mount = document.querySelector('[data-page-module]');
  const module = mount?.dataset.pageModule;
  setBreadcrumb([{ label: role.charAt(0).toUpperCase() + role.slice(1), href: `/${role}/dashboard.html` }, { label: 'Services' }]);

  if (module === 'admin-services') {
    await renderAdminServices(mount);
    return;
  }

  await renderCitizenServices(mount);
});

function serviceMeta(service) {
  return {
    icon: service.icon || 'apps',
    category: service.category || 'General',
    requirements: Array.isArray(service.requirements) ? service.requirements : [],
    formFields: Array.isArray(service.formFields) ? service.formFields : []
  };
}

async function renderCitizenServices(mount) {
  const services = await getServices();
  const categories = ['All', ...new Set(services.map(service => service.category || 'General'))];

  mount.innerHTML = `
    <div class="filter-bar">
      <div class="search-input-wrapper">
        <span class="material-symbols-outlined">search</span>
        <input class="form-control search-input" id="serviceSearch" placeholder="Search services">
      </div>
      <div class="filter-chips">
        ${categories.map((category, index) => `<button class="chip ${index === 0 ? 'active' : ''}" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('')}
      </div>
    </div>
    <div class="grid-3" id="serviceGrid">
      ${services.map(service => {
        const meta = serviceMeta(service);
        return `
          <article class="service-card" data-category="${escapeHtml(meta.category)}" data-name="${escapeHtml(service.name || '').toLowerCase()}">
            <span class="material-symbols-outlined quick-action-icon">${meta.icon}</span>
            <h3>${escapeHtml(service.name || 'Municipal Service')}</h3>
            <p>${escapeHtml(truncate(service.description || 'Municipal online service.', 140))}</p>
            <p>${meta.requirements.length} requirements | ${formatCurrency(service.baseFee || 0)} | ${service.processingDays || 1} business days</p>
            <div class="action-row">
              <a class="btn btn-primary" href="/citizen/apply.html?serviceId=${service.id}">Apply Now</a>
              <button class="btn btn-secondary btn-sm" data-preview="${service.id}">View Requirements</button>
            </div>
          </article>
        `;
      }).join('')}
    </div>
    <div class="modal-overlay" id="servicePreviewModal" hidden>
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="servicePreviewTitle">Service Details</h2>
          <button class="modal-close" data-close="servicePreviewModal"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="modal-body" id="servicePreviewBody"></div>
      </div>
    </div>
  `;

  const filter = () => {
    const query = document.getElementById('serviceSearch').value.trim().toLowerCase();
    const activeCategory = document.querySelector('.chip.active').dataset.category;
    document.querySelectorAll('.service-card').forEach(card => {
      const matchesSearch = card.dataset.name.includes(query);
      const matchesCategory = activeCategory === 'All' || card.dataset.category === activeCategory;
      card.hidden = !matchesSearch || !matchesCategory;
    });
  };

  document.getElementById('serviceSearch').addEventListener('input', debounce(filter, 120));
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(item => item.classList.remove('active'));
      chip.classList.add('active');
      filter();
    });
  });

  document.querySelectorAll('[data-preview]').forEach(button => {
    button.addEventListener('click', () => {
      const service = services.find(item => item.id === button.dataset.preview);
      const meta = serviceMeta(service);
      document.getElementById('servicePreviewTitle').textContent = service.name;
      document.getElementById('servicePreviewBody').innerHTML = `
        <p>${escapeHtml(service.description || '')}</p>
        <h3>Requirements</h3>
        <ul>${meta.requirements.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>No additional requirements listed.</li>'}</ul>
        <h3 class="mt-4">Application Fields</h3>
        <ul>${meta.formFields.map(field => `<li>${escapeHtml(field.label || field.name)}${field.required ? ' (required)' : ''}</li>`).join('') || '<li>Standard applicant information only.</li>'}</ul>
      `;
      openModal('servicePreviewModal');
    });
  });
}

async function renderAdminServices(mount) {
  const state = {
    services: await getServices(),
    query: '',
    category: 'All'
  };
  renderAdminServicesTable(mount, state);
}

function filteredAdminServices(state) {
  const query = state.query.trim().toLowerCase();
  return state.services
    .filter(service => state.category === 'All' || (service.category || 'General') === state.category)
    .filter(service => !query || [service.name, service.description, service.category].some(value => String(value || '').toLowerCase().includes(query)))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function renderAdminServicesTable(mount, state) {
  const services = filteredAdminServices(state);
  const categories = ['All', ...new Set(state.services.map(service => service.category || 'General'))];
  mount.innerHTML = `
    <div class="card mb-4">
      <div class="card-body">
        <div class="filter-bar">
          <div class="search-input-wrapper">
            <span class="material-symbols-outlined">search</span>
            <input class="form-control search-input" id="adminServiceSearch" value="${escapeHtml(state.query)}" placeholder="Search services">
          </div>
          <select class="form-control" id="adminServiceCategory">
            ${categories.map(category => `<option value="${escapeHtml(category)}" ${state.category === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}
          </select>
          <a class="btn btn-primary" href="/admin/service-form.html">
            <span class="material-symbols-outlined">add</span>
            Add Service
          </a>
          <button class="btn btn-secondary" id="seedServicesBtn">
            <span class="material-symbols-outlined">library_add</span>
            Load Default Services
          </button>
        </div>
      </div>
    </div>
    ${services.length ? `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Name</th><th>Category</th><th>Base Fee</th><th>Processing</th><th>Requirements</th><th>Fields</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            ${services.map(service => {
              const meta = serviceMeta(service);
              return `<tr>
                <td><strong>${escapeHtml(service.name || 'Municipal Service')}</strong><br><small>${escapeHtml(truncate(service.description || '', 80))}</small></td>
                <td>${escapeHtml(meta.category)}</td>
                <td>${formatCurrency(service.baseFee || 0)}</td>
                <td>${service.processingDays || 1} days</td>
                <td>${meta.requirements.length}</td>
                <td>${meta.formFields.length}</td>
                <td>${service.active === false ? '<span class="badge badge-rejected">Inactive</span>' : '<span class="badge badge-approved">Active</span>'}</td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-sm btn-secondary" data-view-service="${service.id}">View</button>
                    <a class="btn btn-sm btn-secondary" href="/admin/service-form.html?id=${service.id}">Edit</a>
                    <button class="btn btn-sm btn-warning" data-toggle-service="${service.id}">${service.active === false ? 'Activate' : 'Deactivate'}</button>
                    <button class="btn btn-sm btn-danger" data-delete-service="${service.id}">Delete</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="empty-state card">
        <span class="material-symbols-outlined empty-state-icon">apps</span>
        <h2 class="empty-state-title">No services found</h2>
        <p class="empty-state-text">Try another search or load the default municipal services.</p>
        <button class="btn btn-primary" id="seedServicesEmptyBtn">Load Default Services</button>
      </div>
    `}
    <div class="modal-overlay" id="adminServiceModal" hidden>
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="adminServiceModalTitle">Service Details</h2>
          <button class="modal-close" data-close="adminServiceModal"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="modal-body" id="adminServiceModalBody"></div>
      </div>
    </div>
  `;

  document.getElementById('adminServiceSearch')?.addEventListener('input', debounce(event => {
    state.query = event.target.value;
    renderAdminServicesTable(mount, state);
  }, 150));

  document.getElementById('adminServiceCategory')?.addEventListener('change', event => {
    state.category = event.target.value;
    renderAdminServicesTable(mount, state);
  });

  const seed = async () => {
    try {
      showLoader();
      const count = await seedDefaultServices();
      showToast(`${count} default services loaded.`, 'success');
      state.services = await getServices();
      renderAdminServicesTable(mount, state);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      hideLoader();
    }
  };

  document.getElementById('seedServicesBtn')?.addEventListener('click', seed);
  document.getElementById('seedServicesEmptyBtn')?.addEventListener('click', seed);

  document.querySelectorAll('[data-view-service]').forEach(button => {
    button.addEventListener('click', () => {
      const service = state.services.find(item => item.id === button.dataset.viewService);
      const meta = serviceMeta(service);
      document.getElementById('adminServiceModalTitle').textContent = service.name || 'Service Details';
      document.getElementById('adminServiceModalBody').innerHTML = `
        <p>${escapeHtml(service.description || '')}</p>
        <p><strong>Category:</strong> ${escapeHtml(meta.category)}</p>
        <p><strong>Base Fee:</strong> ${formatCurrency(service.baseFee || 0)}</p>
        <p><strong>Processing:</strong> ${service.processingDays || 1} business days</p>
        <h3>Requirements</h3>
        <ul>${meta.requirements.map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>No requirements listed.</li>'}</ul>
        <h3 class="mt-4">Form Fields</h3>
        <ul>${meta.formFields.map(field => `<li>${escapeHtml(field.label || field.name)} - ${escapeHtml(field.type || 'text')}${field.required ? ' (required)' : ''}</li>`).join('') || '<li>No dynamic fields listed.</li>'}</ul>
      `;
      openModal('adminServiceModal');
    });
  });

  document.querySelectorAll('[data-toggle-service]').forEach(button => {
    button.addEventListener('click', async () => {
      const service = state.services.find(item => item.id === button.dataset.toggleService);
      if (!service) return;
      const nextActive = service.active === false;
      try {
        await updateService(service.id, { active: nextActive });
        service.active = nextActive;
        showToast(`Service ${nextActive ? 'activated' : 'deactivated'}.`, 'success');
        renderAdminServicesTable(mount, state);
      } catch (error) {
        showToast(error.message, 'error');
      }
    });
  });

  document.querySelectorAll('[data-delete-service]').forEach(button => {
    button.addEventListener('click', () => {
      const service = state.services.find(item => item.id === button.dataset.deleteService);
      if (!service) return;
      confirmDialog(`Delete ${service.name}? This will remove it from the services list.`, async () => {
        try {
          await deleteService(service.id);
          state.services = state.services.filter(item => item.id !== service.id);
          showToast('Service deleted.', 'success');
          renderAdminServicesTable(mount, state);
        } catch (error) {
          showToast(error.message, 'error');
        }
      });
    });
  });
}
