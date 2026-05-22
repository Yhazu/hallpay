/* /assets/js/pages/permit-viewer.js */
document.addEventListener('DOMContentLoaded', async () => {
  const role = document.body.dataset.role || 'citizen';
  if (document.body.dataset.public !== 'true') await requireAuth([role]);
  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([
    { label: role.charAt(0).toUpperCase() + role.slice(1), href: `/${role}/dashboard.html` },
    { label: 'Permit Viewer' }
  ]);

  const mount = document.querySelector('[data-page-module]');
  if (!mount) return;

  const permitId = getQueryParam('id');
  const appId = getQueryParam('appId');
  if (!permitId && !appId) {
    renderPermitEmpty(mount);
    return;
  }

  try {
    const permit = await loadPermitRecord(permitId, appId);
    if (!permit) {
      renderPermitEmpty(mount, 'Permit not found', 'No permit record was found for this link.');
      return;
    }
    renderPermitViewer(mount, normalizePermit(permit));
  } catch (error) {
    console.error('Permit viewer error:', error);
    renderPermitEmpty(mount, 'Unable to load permit', 'Please open the permit from your application details.');
  }
});

async function loadPermitRecord(permitId, appId) {
  if (!appId && permitId === 'permit-demo') {
    return demoPermitRecord();
  }

  if (appId) {
    const permit = await getPermitByApplicationId(appId);
    if (permit) return permit;
    return buildPermitFromApplication(appId);
  }

  const permit = await getPermit(permitId);
  if (permit) return permit;

  return buildPermitFromApplication(permitId === 'permit-demo' ? 'app-002' : permitId);
}

function demoPermitRecord() {
  return {
    id: 'permit-demo',
    permitNumber: 'BUS-2026-0123',
    permitType: 'Business Permit',
    citizenName: window.currentUser?.fullName || 'Citizen',
    address: window.currentUser?.address || 'Kabacan, North Cotabato',
    issueDate: new Date('2026-05-10'),
    expiryDate: new Date('2027-05-10'),
    mayorName: 'Municipal Mayor',
    qrData: 'HALLPAY|PERMIT|permit-demo|BUS-2026-0123|valid|2027-05-10'
  };
}

async function buildPermitFromApplication(appId) {
  const application = await getApplication(appId);
  if (!application) return null;
  const createdAt = application.updatedAt || application.createdAt || new Date();
  const expiryDate = new Date(toDate(createdAt));
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  const permitType = application.serviceName || 'Municipal Permit';
  const permitNumber = application.permitNumber || generatePermitNumber(permitType);
  return {
    id: `permit-${application.id}`,
    applicationId: application.id,
    permitNumber,
    permitType,
    citizenName: application.citizenName || application.fullName || window.currentUser?.fullName || 'Citizen',
    address: application.address || application.formData?.businessAddress || window.currentUser?.address || 'Kabacan, North Cotabato',
    issueDate: createdAt,
    expiryDate,
    mayorName: application.mayorName || 'Municipal Mayor',
    qrData: `HALLPAY|PERMIT|permit-${application.id}|${permitNumber}|valid|${expiryDate.toISOString().slice(0, 10)}`
  };
}

function normalizePermit(permit) {
  return {
    id: permit.id || 'permit-demo',
    permitNumber: permit.permitNumber || permit.referenceNumber || 'PERMIT-DEMO',
    permitType: permit.permitType || 'Municipal Permit',
    citizenName: permit.citizenName || permit.issuedTo || window.currentUser?.fullName || 'Citizen',
    address: permit.address || window.currentUser?.address || 'Kabacan, North Cotabato',
    issueDate: permit.issueDate || permit.issuedAt || permit.createdAt || new Date(),
    expiryDate: permit.expiryDate || permit.expiresAt || new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    mayorName: permit.mayorName || 'Municipal Mayor',
    qrData: permit.qrData || `HALLPAY|PERMIT|${permit.id || 'permit-demo'}|${permit.permitNumber || 'PERMIT-DEMO'}|valid`
  };
}

function renderPermitEmpty(mount, title = 'No permit selected', message = 'Open an approved or completed application to view its permit.') {
  document.getElementById('pageSubtitle').textContent = message;
  mount.innerHTML = `
    <div class="empty-state card">
      <span class="material-symbols-outlined empty-state-icon">workspace_premium</span>
      <h2 class="empty-state-title">${escapeHtml(title)}</h2>
      <p class="empty-state-text">${escapeHtml(message)}</p>
      <div class="action-row" style="justify-content:center">
        <a class="btn btn-primary" href="/citizen/my-applications.html">My Applications</a>
        <a class="btn btn-secondary" href="/citizen/dashboard.html">Dashboard</a>
      </div>
    </div>
  `;
}

function renderPermitViewer(mount, permit) {
  document.getElementById('pageTitle').textContent = permit.permitType;
  document.getElementById('pageSubtitle').textContent = `Permit No. ${permit.permitNumber}`;

  mount.innerHTML = `
    <section class="permit-paper">
      <p>Republic of the Philippines<br>Municipality of Kabacan<br><strong>OFFICE OF THE MAYOR</strong></p>
      <div class="doc-line"></div>
      <h1>${escapeHtml(permit.permitType)}</h1>
      <h3>PERMIT NO. ${escapeHtml(permit.permitNumber)}</h3>
      <p>THIS IS TO CERTIFY THAT:</p>
      <h2>${escapeHtml(permit.citizenName)}</h2>
      <p>located at ${escapeHtml(permit.address)}</p>
      <p>is hereby granted this ${escapeHtml(String(permit.permitType).toLowerCase())} for the period:</p>
      <p><strong>${formatDate(permit.issueDate)} to ${formatDate(permit.expiryDate)}</strong></p>
      <div id="qrCode" style="display:grid;place-items:center;margin:20px"></div>
      <p>Scan to verify document authenticity</p>
      <p class="mt-4">____________________<br>${escapeHtml(permit.mayorName)}<br>Municipal Mayor</p>
    </section>
    <div class="action-row mt-4 no-print" style="justify-content:center">
      <button class="btn btn-primary" id="permitPdfBtn"><span class="material-symbols-outlined">download</span>Download PDF</button>
      <button class="btn btn-secondary" id="permitPrintBtn"><span class="material-symbols-outlined">print</span>Print</button>
      <a class="btn btn-secondary" href="/citizen/my-applications.html">My Applications</a>
    </div>
  `;

  if (window.QRCode) {
    new QRCode(document.getElementById('qrCode'), { text: permit.qrData, width: 140, height: 140 });
  }

  document.getElementById('permitPrintBtn').addEventListener('click', () => print());
  document.getElementById('permitPdfBtn').addEventListener('click', () => {
    if (!window.jspdf || !window.generatePermitPDF) {
      showToast('PDF tools are still loading. Please try again.', 'warning');
      return;
    }
    generatePermitPDF(permit);
  });
}
