/* /assets/js/pages/apply.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['citizen']);
  if (window.renderSidebar) await renderSidebar('citizen');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Citizen', href: '/citizen/dashboard.html' }, { label: 'New Application' }]);

  const mount = document.querySelector('[data-page-module]');
  const services = await getServices();
  const serviceId = getQueryParam('serviceId');
  const selected = serviceId ? await getService(serviceId) : null;
  const state = {
    step: selected ? 1 : 0,
    services,
    selected,
    formData: {},
    documents: {}
  };

  renderApplyPage(mount, state);
});

function normalizeService(service) {
  return {
    id: service?.id || '',
    name: service?.name || 'Municipal Service',
    category: service?.category || 'General',
    description: service?.description || 'Municipal online service.',
    baseFee: Number(service?.baseFee || 0),
    processingDays: Number(service?.processingDays || 1),
    icon: service?.icon || 'apps',
    requirements: Array.isArray(service?.requirements) ? service.requirements : [],
    formFields: Array.isArray(service?.formFields) ? service.formFields : []
  };
}

function renderSteps(activeStep) {
  return `
    <div class="steps">
      ${['Select Service', 'Fill Form', 'Upload Docs', 'Review'].map((label, index) => `
        <div class="step ${index < activeStep ? 'done' : index === activeStep ? 'active' : 'pending'}">
          <span class="step-number">${index + 1}</span>
          <span class="step-label">${label}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderApplyPage(mount, state) {
  mount.innerHTML = renderSteps(state.step) + `<section id="applyStepHost"></section>`;
  const host = document.getElementById('applyStepHost');

  if (state.step === 0) renderServiceSelection(host, state, mount);
  if (state.step === 1) renderApplicationForm(host, state, mount);
  if (state.step === 2) renderDocumentUpload(host, state, mount);
  if (state.step === 3) renderReview(host, state, mount);
}

function renderServiceSelection(host, state, mount) {
  host.innerHTML = `
    <div class="filter-bar">
      <div class="search-input-wrapper">
        <span class="material-symbols-outlined">search</span>
        <input class="form-control search-input" id="applyServiceSearch" placeholder="Search services">
      </div>
    </div>
    <div class="grid-3" id="applyServiceGrid">
      ${state.services.map(raw => {
        const service = normalizeService(raw);
        return `
          <article class="service-card" data-name="${escapeHtml(service.name).toLowerCase()}">
            <span class="material-symbols-outlined quick-action-icon">${service.icon}</span>
            <h3>${escapeHtml(service.name)}</h3>
            <p>${escapeHtml(service.description)}</p>
            <p>${service.requirements.length} requirements | ${formatCurrency(service.baseFee)} | ${service.processingDays} business days</p>
            <button class="btn btn-primary" data-select-service="${service.id}">Select Service</button>
          </article>
        `;
      }).join('')}
    </div>
  `;

  document.getElementById('applyServiceSearch').addEventListener('input', event => {
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll('#applyServiceGrid .service-card').forEach(card => {
      card.hidden = !card.dataset.name.includes(query);
    });
  });

  document.querySelectorAll('[data-select-service]').forEach(button => {
    button.addEventListener('click', () => {
      state.selected = state.services.find(service => service.id === button.dataset.selectService);
      state.step = 1;
      renderApplyPage(mount, state);
    });
  });
}

function renderApplicationForm(host, state, mount) {
  const service = normalizeService(state.selected);
  const fields = service.formFields.length ? service.formFields : [
    { name: 'purpose', label: 'Purpose', type: 'textarea', required: true },
    { name: 'notes', label: 'Additional Notes', type: 'textarea', required: false }
  ];

  host.innerHTML = `
    <form class="card" id="applicationForm">
      <div class="card-header">
        <div>
          <h2 class="card-title">${escapeHtml(service.name)}</h2>
          <p>${escapeHtml(service.category)} | ${formatCurrency(service.baseFee)} | ${service.processingDays} business days</p>
        </div>
        <button class="btn btn-secondary btn-sm" type="button" id="changeServiceBtn">Change Service</button>
      </div>
      <div class="card-body">
        ${fields.map(field => renderDynamicField(field, state.formData[field.name])).join('')}
        <div class="action-row">
          <button class="btn btn-primary">Continue to Documents</button>
        </div>
      </div>
    </form>
  `;

  document.getElementById('changeServiceBtn').addEventListener('click', () => {
    state.step = 0;
    renderApplyPage(mount, state);
  });

  document.getElementById('applicationForm').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const invalid = [...form.querySelectorAll('[required]')].find(input => !String(input.value || '').trim());
    if (invalid) {
      invalid.focus();
      showToast('Please complete all required fields.', 'warning');
      return;
    }
    state.formData = Object.fromEntries(new FormData(form));
    state.step = 2;
    renderApplyPage(mount, state);
  });
}

function renderDynamicField(field, value = '') {
  const required = field.required ? 'required' : '';
  const label = `<span class="form-label ${field.required ? 'required' : ''}">${escapeHtml(field.label || field.name)}</span>`;
  if (field.type === 'textarea') {
    return `<label class="form-group">${label}<textarea class="form-control" name="${escapeHtml(field.name)}" ${required}>${escapeHtml(value)}</textarea></label>`;
  }
  if (field.type === 'dropdown') {
    const options = Array.isArray(field.options) ? field.options : [];
    return `<label class="form-group">${label}<select class="form-control" name="${escapeHtml(field.name)}" ${required}>${options.map(option => `<option ${value === option ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`;
  }
  return `<label class="form-group">${label}<input class="form-control" type="${field.type || 'text'}" name="${escapeHtml(field.name)}" value="${escapeHtml(value)}" ${required}></label>`;
}

function renderDocumentUpload(host, state, mount) {
  const service = normalizeService(state.selected);
  const requirements = service.requirements.length ? service.requirements : ['Valid ID'];

  host.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Upload Documents</h2>
        <button class="btn btn-secondary btn-sm" id="backToFormBtn">Back</button>
      </div>
      <div class="card-body">
        ${requirements.map((requirement, index) => `
          <label class="upload-zone mb-4" data-upload-zone="${index}">
            <input type="file" data-document="${escapeHtml(requirement)}" hidden>
            <span class="material-symbols-outlined upload-zone-icon">upload_file</span>
            <div class="upload-zone-text">${escapeHtml(requirement)}</div>
            <small class="upload-zone-hint">${state.documents[requirement]?.name || 'Click to select PDF, PNG, or JPG'}</small>
          </label>
        `).join('')}
        <div class="action-row">
          <button class="btn btn-primary" id="continueReviewBtn">Review Application</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('backToFormBtn').addEventListener('click', () => {
    state.step = 1;
    renderApplyPage(mount, state);
  });

  document.querySelectorAll('[data-document]').forEach(input => {
    input.addEventListener('change', () => {
      const requirement = input.dataset.document;
      const file = input.files[0];
      if (!file) return;
      state.documents[requirement] = { name: file.name, size: file.size, file };
      input.closest('.upload-zone').querySelector('.upload-zone-hint').textContent = file.name;
      input.closest('.upload-zone').classList.add('drag-over');
    });
  });

  document.getElementById('continueReviewBtn').addEventListener('click', () => {
    const missing = requirements.filter(requirement => !state.documents[requirement]);
    if (missing.length) {
      showToast(`Please upload: ${missing[0]}`, 'warning');
      return;
    }
    state.step = 3;
    renderApplyPage(mount, state);
  });
}

function renderReview(host, state, mount) {
  const service = normalizeService(state.selected);
  const documents = Object.entries(state.documents);

  host.innerHTML = `
    <div class="content-split">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Review & Submit</h2>
          <button class="btn btn-secondary btn-sm" id="backToDocsBtn">Back</button>
        </div>
        <div class="card-body">
          <h3>${escapeHtml(service.name)}</h3>
          <p>${escapeHtml(service.description)}</p>
          <div class="table-wrapper mb-4">
            <table>
              <tbody>
                ${Object.entries(state.formData).map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
          <h3>Documents</h3>
          ${documents.map(([name, doc]) => `<p><span class="badge badge-approved">Uploaded</span> ${escapeHtml(name)} - ${escapeHtml(doc.name)}</p>`).join('')}
          <div class="alert alert-info mt-4">Estimated fee: ${formatCurrency(service.baseFee)}. By submitting, you certify that the provided information and uploaded documents are true and correct.</div>
          <button class="btn btn-primary" id="submitApplicationBtn">Submit Application</button>
        </div>
      </div>
      <aside class="card">
        <div class="card-header"><h2 class="card-title">Fee Estimate</h2></div>
        <div class="card-body">
          <p>Base Fee</p>
          <h2>${formatCurrency(service.baseFee)}</h2>
          <p>Final assessment may include additional processing or statutory fees.</p>
        </div>
      </aside>
    </div>
  `;

  document.getElementById('backToDocsBtn').addEventListener('click', () => {
    state.step = 2;
    renderApplyPage(mount, state);
  });

  document.getElementById('submitApplicationBtn').addEventListener('click', async () => {
    try {
      showLoader();
      const uploadedDocuments = [];
      for (const [name, doc] of documents) {
        const url = await uploadApplicationDocument(`draft-${window.currentUser.uid}`, doc.file, doc.name);
        uploadedDocuments.push({ name, fileName: doc.name, size: doc.size, url, uploadedAt: new Date() });
      }
      const applicationId = await createApplication({
        userId: window.currentUser.uid,
        citizenName: window.currentUser.fullName,
        email: window.currentUser.email,
        phone: window.currentUser.phone || '',
        address: window.currentUser.address || '',
        serviceId: service.id,
        serviceName: service.name,
        baseFee: service.baseFee,
        formData: state.formData,
        documents: uploadedDocuments
      });
      showToast('Application submitted successfully.', 'success');
      location.href = `/citizen/application-details.html?id=${applicationId}`;
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      hideLoader();
    }
  });
}
