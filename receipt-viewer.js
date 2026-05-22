/* /assets/js/pages/receipt-viewer.js */
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
    { label: 'Official Receipt' }
  ]);

  const mount = document.querySelector('[data-page-module]');
  if (!mount) return;

  const receiptId = getQueryParam('id') || getQueryParam('receiptId');
  const appId = getQueryParam('appId');
  if (!receiptId && !appId) {
    renderReceiptEmpty(mount);
    return;
  }

  try {
    const receipt = await loadReceiptRecord(receiptId, appId);
    if (!receipt) {
      renderReceiptEmpty(mount, 'Receipt not found', 'No official receipt was found for this link.');
      return;
    }
    renderReceiptViewer(mount, normalizeReceipt(receipt));
  } catch (error) {
    console.error('Receipt viewer error:', error);
    renderReceiptEmpty(mount, 'Unable to load receipt', 'Please open the receipt from your transaction history.');
  }
});

async function loadReceiptRecord(receiptId, appId) {
  if (!appId && ['receipt-demo', 'rcp-demo'].includes(receiptId)) {
    return demoReceiptRecord(receiptId);
  }

  if (appId) {
    const receipt = await getReceiptByApplicationId(appId);
    if (receipt) return receipt;
    return buildReceiptFromApplication(appId);
  }

  const receipt = await getReceipt(receiptId);
  if (receipt) return receipt;

  if (receiptId) {
    const payment = await getPayment(receiptId);
    if (payment) return buildReceiptFromPayment(payment);
  }

  return buildReceiptFromApplication('app-002');
}

function demoReceiptRecord(id = 'receipt-demo') {
  return {
    id,
    receiptNumber: 'RCP-20260510001',
    citizenName: window.currentUser?.fullName || 'Citizen',
    amount: 120,
    serviceName: 'Community Tax Certificate',
    referenceNumber: 'HALLPAY-2026-02780',
    method: 'GCash',
    createdAt: new Date('2026-05-10'),
    qrData: `HALLPAY|RECEIPT|${id}|RCP-20260510001|confirmed|app-002`
  };
}

async function buildReceiptFromApplication(appId) {
  const [application, payments] = await Promise.all([
    getApplication(appId),
    getAllPayments({ userId: window.currentUser?.uid })
  ]);
  const payment = payments.find(item => item.applicationId === appId) || {};
  if (!application && !payment.id) return null;
  return buildReceiptFromPayment({
    ...payment,
    applicationId: appId,
    serviceName: payment.serviceName || application?.serviceName,
    referenceNumber: payment.referenceNumber || application?.referenceNumber,
    amount: payment.amount || application?.amount || application?.baseFee || 0,
    citizenName: payment.citizenName || application?.citizenName || window.currentUser?.fullName,
    createdAt: payment.confirmedAt || payment.createdAt || application?.updatedAt || application?.createdAt
  });
}

function buildReceiptFromPayment(payment) {
  const id = payment.receiptId || `receipt-${payment.applicationId || payment.id || 'demo'}`;
  const receiptNumber = payment.receiptNumber || generateReceiptNumber();
  return {
    id,
    receiptNumber,
    paymentId: payment.id,
    applicationId: payment.applicationId,
    citizenName: payment.citizenName || payment.payerName || window.currentUser?.fullName || 'Citizen',
    amount: payment.amount || 0,
    serviceName: payment.serviceName || 'Municipal Service',
    referenceNumber: payment.referenceNumber || payment.transactionReference || payment.applicationId || payment.id,
    method: payment.method || payment.paymentMethod || 'Manual',
    createdAt: payment.confirmedAt || payment.createdAt || new Date(),
    qrData: `HALLPAY|RECEIPT|${id}|${receiptNumber}|confirmed|${payment.applicationId || ''}`
  };
}

function normalizeReceipt(receipt) {
  const id = receipt.id || 'receipt-demo';
  const receiptNumber = receipt.receiptNumber || receipt.referenceNumber || 'RCP-DEMO';
  return {
    id,
    receiptNumber,
    citizenName: receipt.citizenName || receipt.issuedTo || window.currentUser?.fullName || 'Citizen',
    amount: Number(receipt.amount || 0),
    serviceName: receipt.serviceName || receipt.description || 'Municipal Service',
    referenceNumber: receipt.referenceNumber || receipt.applicationId || receipt.paymentId || id,
    method: receipt.method || receipt.paymentMethod || 'Manual',
    createdAt: receipt.createdAt || receipt.issuedAt || receipt.confirmedAt || new Date(),
    qrData: receipt.qrData || `HALLPAY|RECEIPT|${id}|${receiptNumber}|confirmed|${receipt.applicationId || ''}`
  };
}

function renderReceiptEmpty(mount, title = 'No receipt selected', message = 'Open a confirmed payment from your transaction history to view its official receipt.') {
  document.getElementById('pageSubtitle').textContent = message;
  mount.innerHTML = `
    <div class="empty-state card">
      <span class="material-symbols-outlined empty-state-icon">receipt_long</span>
      <h2 class="empty-state-title">${escapeHtml(title)}</h2>
      <p class="empty-state-text">${escapeHtml(message)}</p>
      <div class="action-row" style="justify-content:center">
        <a class="btn btn-primary" href="/citizen/transaction-history.html">Transaction History</a>
        <a class="btn btn-secondary" href="/citizen/dashboard.html">Dashboard</a>
      </div>
    </div>
  `;
}

function renderReceiptViewer(mount, receipt) {
  document.getElementById('pageTitle').textContent = 'Official Receipt';
  document.getElementById('pageSubtitle').textContent = `Receipt No. ${receipt.receiptNumber}`;

  mount.innerHTML = `
    <section class="receipt-paper">
      <h3>REPUBLIC OF THE PHILIPPINES</h3>
      <p>Municipality of Kabacan, North Cotabato</p>
      <div class="doc-line"></div>
      <h1>OFFICIAL RECEIPT</h1>
      <h3>No. ${escapeHtml(receipt.receiptNumber)}</h3>
      <p>Date: <strong>${formatDate(receipt.createdAt)}</strong></p>
      <p>Received from: <strong>${escapeHtml(receipt.citizenName)}</strong></p>
      <p>Amount: <strong>${formatCurrency(receipt.amount)}</strong></p>
      <p>${escapeHtml(amountInWords(receipt.amount))}</p>
      <p>As payment for: ${escapeHtml(receipt.serviceName)}</p>
      <p>Reference No: ${escapeHtml(receipt.referenceNumber)}</p>
      <p>Payment Method: ${escapeHtml(receipt.method)}</p>
      <div id="qrCode" style="display:grid;place-items:center;margin:20px"></div>
      <p>Scan to verify authenticity</p>
      <div class="doc-line"></div>
      <p><strong>Municipal Treasurer</strong><br>This is a computer-generated receipt.</p>
    </section>
    <div class="action-row mt-4 no-print" style="justify-content:center">
      <button class="btn btn-primary" id="receiptPdfBtn"><span class="material-symbols-outlined">download</span>Download PDF</button>
      <button class="btn btn-secondary" id="receiptPrintBtn"><span class="material-symbols-outlined">print</span>Print</button>
      <a class="btn btn-secondary" href="/citizen/transaction-history.html">Transaction History</a>
    </div>
  `;

  if (window.QRCode) {
    new QRCode(document.getElementById('qrCode'), { text: receipt.qrData, width: 128, height: 128 });
  }

  document.getElementById('receiptPrintBtn').addEventListener('click', () => print());
  document.getElementById('receiptPdfBtn').addEventListener('click', () => {
    if (!window.jspdf || !window.generateReceiptPDF) {
      showToast('PDF tools are still loading. Please try again.', 'warning');
      return;
    }
    generateReceiptPDF(receipt);
  });
}
