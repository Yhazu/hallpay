/* /assets/js/pages/confirm-payment.js */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth(['treasurer', 'admin']);
  const role = ['treasurer', 'admin'].includes(user.role) ? user.role : 'treasurer';

  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([
    { label: role === 'admin' ? 'Admin' : 'Treasurer', href: `/${role}/dashboard.html` },
    { label: 'Payments', href: '/treasurer/payments.html' },
    { label: 'Confirm' }
  ]);

  const mount = document.querySelector('[data-page-module]');
  const payment = await getPayment(getQueryParam('id'));
  renderConfirmPaymentPage(mount, payment, role);
});

function renderConfirmPaymentPage(mount, payment, role) {
  if (!payment) {
    mount.innerHTML = `
      <div class="empty-state card">
        <span class="material-symbols-outlined empty-state-icon">payments</span>
        <h2 class="empty-state-title">Payment not found</h2>
        <a class="btn btn-primary" href="/treasurer/payments.html">Back to Payments</a>
      </div>
    `;
    return;
  }

  mount.innerHTML = `
    <div class="content-split">
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Payment Summary</h2>
          ${paymentStatusBadgeForConfirm(payment.status)}
        </div>
        <div class="card-body">
          <dl class="details-list">
            <div><dt>Reference</dt><dd>${escapeHtml(payment.referenceNumber || payment.id)}</dd></div>
            <div><dt>Citizen</dt><dd>${escapeHtml(payment.citizenName || payment.fullName || 'Citizen')}</dd></div>
            <div><dt>Service</dt><dd>${escapeHtml(payment.serviceName || 'Municipal Service')}</dd></div>
            <div><dt>Amount</dt><dd>${formatCurrency(payment.amount || 0)}</dd></div>
            <div><dt>Method</dt><dd>${escapeHtml(payment.method || 'Manual')}</dd></div>
            <div><dt>Channel</dt><dd>${escapeHtml(payment.paymentChannel || 'N/A')}</dd></div>
            <div><dt>Transaction Ref.</dt><dd>${escapeHtml(payment.transactionReference || 'N/A')}</dd></div>
            <div><dt>Payer Details</dt><dd>${escapeHtml(payment.payerAccount || 'N/A')}</dd></div>
            <div><dt>Submitted</dt><dd>${formatDateTime(payment.createdAt)}</dd></div>
          </dl>
          ${payment.paymentNotes ? `<div class="alert alert-info mt-4"><span class="material-symbols-outlined">notes</span><span>${escapeHtml(payment.paymentNotes)}</span></div>` : ''}
          ${payment.proofUrl ? `<a class="btn btn-secondary mt-4" href="${payment.proofUrl}" target="_blank"><span class="material-symbols-outlined">image</span>View Proof</a>` : '<div class="alert alert-warning mt-4"><span class="material-symbols-outlined">info</span><span>No proof file is attached to this demo payment.</span></div>'}
        </div>
      </section>

      <aside>
        <form class="card" id="confirmPaymentForm">
          <div class="card-header"><h2 class="card-title">${role === 'admin' ? 'Admin Confirmation' : 'Treasury Confirmation'}</h2></div>
          <div class="card-body">
            ${role === 'admin' ? '<div class="alert alert-info"><span class="material-symbols-outlined">admin_panel_settings</span><span>Admin access is enabled for payment review and correction.</span></div>' : ''}
            <label class="form-group">
              <span class="form-label required">Decision</span>
              <select class="form-control" name="status" required>
                <option value="confirmed">Confirm payment</option>
                <option value="failed">Mark as failed</option>
              </select>
            </label>
            <label class="form-group">
              <span class="form-label">Treasury Remarks</span>
              <textarea class="form-control" name="remarks" placeholder="Optional remarks for audit trail."></textarea>
            </label>
            <button class="btn btn-primary btn-block" type="submit"><span class="material-symbols-outlined">fact_check</span>Save Decision</button>
          </div>
        </form>
      </aside>
    </div>
  `;

  document.getElementById('confirmPaymentForm').addEventListener('submit', async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    showLoader();
    try {
      await updatePaymentStatus(payment.id, data.status, { remarks: data.remarks || null });
      showToast(data.status === 'confirmed' ? 'Payment confirmed.' : 'Payment marked as failed.', 'success');
      location.href = '/treasurer/payments.html';
    } catch (error) {
      showToast(error.message || 'Unable to update payment.', 'error');
    } finally {
      hideLoader();
    }
  });
}

function paymentStatusBadgeForConfirm(status) {
  const value = String(status || 'pending').toLowerCase();
  if (['confirmed', 'paid', 'completed'].includes(value)) return '<span class="badge badge-paid">Confirmed</span>';
  if (['failed', 'rejected', 'cancelled'].includes(value)) return '<span class="badge badge-rejected">Failed</span>';
  return '<span class="badge badge-pay-pending">Pending</span>';
}
