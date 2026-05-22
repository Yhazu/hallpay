/* /assets/js/pages/service-form.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['admin']);
  if (window.renderSidebar) await renderSidebar('admin');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Admin', href: '/admin/dashboard.html' }, { label: 'Services', href: '/admin/services.html' }, { label: 'Service Form' }]);

  const mount = document.querySelector('[data-page-module]');
  const serviceId = getQueryParam('id');
  const service = serviceId ? await getService(serviceId) : {
    id: '',
    name: '',
    category: 'Permits',
    description: '',
    baseFee: 0,
    processingDays: 1,
    icon: 'apps',
    active: true,
    requirements: ['Valid ID'],
    formFields: [{ name: 'purpose', label: 'Purpose', type: 'textarea', required: true }]
  };

  mount.innerHTML = `
    <form class="card" id="serviceForm">
      <div class="card-header">
        <h2 class="card-title">${serviceId ? 'Edit Service' : 'Add Service'}</h2>
        <button class="btn btn-primary">Save Service</button>
      </div>
      <div class="card-body">
        <div class="grid-2">
          <label class="form-group"><span class="form-label required">Service Name</span><input class="form-control" name="name" value="${escapeHtml(service.name)}" required></label>
          <label class="form-group"><span class="form-label required">Category</span><select class="form-control" name="category">${['Permits','Taxes','Clearances','Certificates'].map(category => `<option ${service.category === category ? 'selected' : ''}>${category}</option>`).join('')}</select></label>
          <label class="form-group"><span class="form-label required">Base Fee</span><input class="form-control" type="number" min="0" step="0.01" name="baseFee" value="${service.baseFee || 0}" required></label>
          <label class="form-group"><span class="form-label required">Processing Days</span><input class="form-control" type="number" min="1" name="processingDays" value="${service.processingDays || 1}" required></label>
          <label class="form-group"><span class="form-label">Material Icon</span><input class="form-control" name="icon" value="${escapeHtml(service.icon || 'apps')}"></label>
          <label class="switch"><span>Active</span><input type="checkbox" name="active" ${service.active === false ? '' : 'checked'}></label>
        </div>
        <label class="form-group"><span class="form-label required">Description</span><textarea class="form-control" name="description" required>${escapeHtml(service.description)}</textarea></label>

        <div class="card mb-4">
          <div class="card-header"><h3 class="card-title">Requirements</h3><button type="button" class="btn btn-sm btn-secondary" id="addRequirementBtn">Add Requirement</button></div>
          <div class="card-body" id="requirementsList"></div>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Form Fields</h3><button type="button" class="btn btn-sm btn-secondary" id="addFieldBtn">Add Field</button></div>
          <div class="card-body" id="fieldsList"></div>
        </div>
      </div>
    </form>
  `;

  let requirements = [...(service.requirements || [])];
  let fields = [...(service.formFields || [])];

  const renderRequirements = () => {
    document.getElementById('requirementsList').innerHTML = requirements.map((item, index) => `
      <div class="action-row mb-4">
        <input class="form-control" data-requirement="${index}" value="${escapeHtml(item)}" placeholder="Requirement name">
        <button type="button" class="btn btn-sm btn-danger" data-remove-requirement="${index}">Remove</button>
      </div>
    `).join('');

    document.querySelectorAll('[data-requirement]').forEach(input => {
      input.addEventListener('input', () => requirements[Number(input.dataset.requirement)] = input.value);
    });
    document.querySelectorAll('[data-remove-requirement]').forEach(button => {
      button.addEventListener('click', () => {
        requirements.splice(Number(button.dataset.removeRequirement), 1);
        renderRequirements();
      });
    });
  };

  const renderFields = () => {
    document.getElementById('fieldsList').innerHTML = fields.map((field, index) => `
      <div class="card mb-4">
        <div class="card-body">
          <div class="grid-4">
            <input class="form-control" data-field="${index}" data-key="label" value="${escapeHtml(field.label || '')}" placeholder="Label">
            <input class="form-control" data-field="${index}" data-key="name" value="${escapeHtml(field.name || '')}" placeholder="fieldName">
            <select class="form-control" data-field="${index}" data-key="type">
              ${['text','textarea','number','dropdown','date'].map(type => `<option value="${type}" ${field.type === type ? 'selected' : ''}>${type}</option>`).join('')}
            </select>
            <label class="switch"><span>Required</span><input type="checkbox" data-field="${index}" data-key="required" ${field.required ? 'checked' : ''}></label>
          </div>
          <input class="form-control mt-4" data-field="${index}" data-key="options" value="${escapeHtml((field.options || []).join(', '))}" placeholder="Dropdown options, comma-separated">
          <button type="button" class="btn btn-sm btn-danger mt-4" data-remove-field="${index}">Remove Field</button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('[data-field]').forEach(control => {
      control.addEventListener('input', updateField);
      control.addEventListener('change', updateField);
    });
    document.querySelectorAll('[data-remove-field]').forEach(button => {
      button.addEventListener('click', () => {
        fields.splice(Number(button.dataset.removeField), 1);
        renderFields();
      });
    });
  };

  function updateField(event) {
    const control = event.currentTarget;
    const field = fields[Number(control.dataset.field)];
    const key = control.dataset.key;
    if (key === 'required') field.required = control.checked;
    else if (key === 'options') field.options = control.value.split(',').map(item => item.trim()).filter(Boolean);
    else field[key] = control.value;
  }

  document.getElementById('addRequirementBtn').addEventListener('click', () => {
    requirements.push('');
    renderRequirements();
  });

  document.getElementById('addFieldBtn').addEventListener('click', () => {
    fields.push({ name: '', label: '', type: 'text', required: false });
    renderFields();
  });

  document.getElementById('serviceForm').addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get('name').trim(),
      category: formData.get('category'),
      description: formData.get('description').trim(),
      baseFee: Number(formData.get('baseFee') || 0),
      processingDays: Number(formData.get('processingDays') || 1),
      icon: formData.get('icon').trim() || 'apps',
      active: formData.get('active') === 'on',
      requirements: requirements.map(item => item.trim()).filter(Boolean),
      formFields: fields
        .filter(field => field.name && field.label)
        .map(field => ({
          ...field,
          name: field.name.trim(),
          label: field.label.trim(),
          options: field.type === 'dropdown' ? (field.options || []).filter(Boolean) : []
        })),
      updatedAt: isFirebaseConfigured() ? serverTime() : new Date()
    };

    try {
      showLoader();
      const hasBadDropdown = payload.formFields.some(field => field.type === 'dropdown' && !field.options.length);
      if (hasBadDropdown) {
        showToast('Dropdown fields need at least one option.', 'warning');
        return;
      }

      const id = serviceId || payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      await saveService(id, payload);
      showToast('Service saved.', 'success');
      location.href = '/admin/services.html';
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      hideLoader();
    }
  });

  renderRequirements();
  renderFields();
});
