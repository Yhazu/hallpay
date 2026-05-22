/* /assets/js/pages/payment-confirmation.js */
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
    { label: 'Payment Confirmation' }
  ]);

  const mount = document.querySelector('[data-page-module]');
  if (!mount) return;

  const paymentId = getQueryParam('payId') || getQueryParam('id');
  if (!paymentId) {
    renderPaymentConfirmationEmpty(mount);
    return;
  }

  try {
    const payment = await getPayment(paymentId);
    if (!payment) {
      renderPaymentConfirmationEmpty(mount, 'Payment not found', 'The payment record could not be loaded.');
      return;
    }
    renderPaymentConfirmation(mount, payment);
  } catch (error) {
    console.error('Payment confirmation error:', error);
    renderPaymentConfirmationEmpty(mount, 'Unable to load confirmation', 'Please open the confirmation link from your transaction history.');
  }
});

function renderPaymentConfirmationEmpty(mount, title = 'No payment selected', message = 'Open a payment from your transaction history to view its confirmation.') {
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

function renderPaymentConfirmation(mount, payment) {
  const isConfirmed = ['confirmed', 'paid', 'completed'].includes(String(payment.status || '').toLowerCase());
  const statusText = isConfirmed ? 'Payment Confirmed' : 'Payment Submitted';
  document.getElementById('pageTitle').textContent = statusText;
  document.getElementById('pageSubtitle').textContent = isConfirmed
    ? 'Your payment has been confirmed and a receipt can be generated.'
    : 'Your proof of payment was submitted and is waiting for treasury confirmation.';

  mount.innerHTML = `
    <section class="card payment-success-card">
      <div class="card-body" style="text-align:center;max-width:680px;margin:0 auto">
        <div class="checkmark">${isConfirmed ? '✓' : '!'}</div>
        <h1>${statusText}</h1>
        <p>${isConfirmed ? 'Thank you. This transaction is recorded in HALL-PAY.' : 'The treasurer will review your proof before issuing the official receipt.'}</p>
        <dl class="details-list mt-4" style="text-align:left">
          ${confirmationRow('Amount', formatCurrency(payment.amount || 0))}
          ${confirmationRow('Payment Method', payment.method || payment.paymentMethod || 'N/A')}
          ${confirmationRow('Payment Reference', payment.referenceNumber || payment.id)}
          ${confirmationRow('Transaction Ref.', payment.transactionReference || 'N/A')}
          ${confirmationRow('Status', payment.status || 'pending')}
          ${confirmationRow('Date & Time', formatDateTime(payment.createdAt || new Date()))}
        </dl>
        <div class="action-row mt-4" style="justify-content:center">
          <button class="btn btn-primary" id="downloadReceiptBtn">
            <span class="material-symbols-outlined">download</span>
            Download Receipt
          </button>
          <a class="btn btn-secondary" href="/citizen/application-details.html?id=${encodeURIComponent(payment.applicationId || '')}">Track Application</a>
          <a class="btn btn-secondary" href="/citizen/dashboard.html">Dashboard</a>
        </div>
      </div>
    </section>
  `;

  document.getElementById('downloadReceiptBtn').addEventListener('click', () => {
    if (!window.jspdf || !window.generateReceiptPDF) {
      showToast('PDF tools are still loading. Please try again.', 'warning');
      return;
    }
    generateReceiptPDF({
      receiptNumber: payment.receiptNumber || generateReceiptNumber(),
      amount: payment.amount || 0,
      method: payment.method || payment.paymentMethod || 'Manual',
      serviceName: payment.serviceName || 'Municipal Service',
      referenceNumber: payment.referenceNumber || payment.id,
      citizenName: payment.citizenName || window.currentUser?.fullName || 'Citizen',
      createdAt: payment.confirmedAt || payment.createdAt || new Date()
    });
  });
}

function confirmationRow(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? 'N/A')}</dd></div>`;
}
