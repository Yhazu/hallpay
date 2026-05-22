/* /assets/js/pages/payment.js */
document.addEventListener('DOMContentLoaded', async () => {
  const role = document.body.dataset.role || 'citizen';
  const user = document.body.dataset.public !== 'true' ? await requireAuth([role]) : window.currentUser;
  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([
    { label: role.charAt(0).toUpperCase() + role.slice(1), href: `/${role}/dashboard.html` },
    { label: 'My Applications', href: '/citizen/my-applications.html' },
    { label: 'Payment' }
  ]);

  const mount = document.querySelector('[data-page-module]');
  if (!mount) return;

  const appId = getQueryParam('appId') || getQueryParam('id');
  if (!appId) {
    renderPaymentEmpty(mount, 'Missing application ID', 'Open a payable application to continue.');
    return;
  }

  try {
    const application = await getApplication(appId);
    if (!application) {
      renderPaymentEmpty(mount, 'Application not found', 'The payment cannot continue because the application record was not found.');
      return;
    }

    const assessment = await getAssessmentByApplicationId(application.id);
    await renderPaymentPage(mount, application, assessment, user || window.currentUser || demoUser);
  } catch (error) {
    console.error('Payment page error:', error);
    renderPaymentEmpty(mount, 'Unable to load payment', 'Please refresh the page or try again later.');
  }
});

function renderPaymentEmpty(mount, title, message) {
  mount.innerHTML = `
    <div class="empty-state card">
      <span class="material-symbols-outlined empty-state-icon">payments</span>
      <h2 class="empty-state-title">${escapeHtml(title)}</h2>
      <p class="empty-state-text">${escapeHtml(message)}</p>
      <a class="btn btn-primary" href="/citizen/my-applications.html">Back to My Applications</a>
    </div>
  `;
}

async function renderPaymentPage(mount, application, assessment, user) {
  const items = assessment?.items || [{ label: 'Amount Due', amount: application.baseFee || 0 }];
  const totalAmount = Number(assessment?.totalAmount ?? items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const canPay = application.status === 'forPayment' && totalAmount > 0;
  const settings = await getPaymentSettings();
  const methods = paymentMethods(settings);

  mount.innerHTML = `
    <div class="content-split">
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Payment Summary</h2>
          ${renderStatusBadge(application.status || 'submitted')}
        </div>
        <div class="card-body">
          <dl class="details-list">
            ${paymentDetailsRow('Reference #', application.referenceNumber || application.id)}
            ${paymentDetailsRow('Service', application.serviceName || 'Municipal Service')}
            ${paymentDetailsRow('Submitted', formatDateTime(application.createdAt))}
            ${items.map(item => paymentDetailsRow(item.label || 'Fee', formatCurrency(item.amount))).join('')}
            ${paymentDetailsRow('Total Amount Due', formatCurrency(totalAmount))}
          </dl>
          ${canPay ? '' : `<div class="alert alert-warning mt-4"><span class="material-symbols-outlined">info</span><span>This application is not currently marked for payment.</span></div>`}
        </div>
      </section>

      <form class="card" id="paymentForm">
        <div class="card-header"><h2 class="card-title">Select Payment Method</h2></div>
        <div class="card-body">
          <div class="payment-method-grid">
            ${methods.map((method, index) => `
              <label class="payment-method-card ${index ? '' : 'selected'}">
                <input type="radio" name="method" value="${escapeHtml(method.id)}" ${index ? '' : 'checked'}>
                <span class="material-symbols-outlined">${escapeHtml(method.icon)}</span>
                <div>
                  <strong>${escapeHtml(method.label)}</strong>
                  <small>${escapeHtml(method.short)}</small>
                </div>
              </label>
            `).join('')}
          </div>

          <div class="payment-instructions mt-4" id="paymentInstructions"></div>

          <div class="grid-2 mt-4">
            <label class="form-group">
              <span class="form-label required" id="paymentRefLabel">Transaction Reference</span>
              <input class="form-control" name="transactionReference" id="transactionReference" placeholder="Reference number" ${canPay ? 'required' : ''}>
            </label>
            <label class="form-group">
              <span class="form-label" id="payerAccountLabel">Account / Mobile Number</span>
              <input class="form-control" name="payerAccount" id="payerAccount" placeholder="Optional">
            </label>
          </div>

          <label class="form-group" id="otherMethodGroup" hidden>
            <span class="form-label required">Payment Provider</span>
            <input class="form-control" name="otherPaymentMethod" id="otherPaymentMethod" placeholder="Example: ShopeePay, PayPal, cash deposit">
          </label>

          <label class="form-group">
            <span class="form-label">Payment Notes</span>
            <textarea class="form-control" name="paymentNotes" placeholder="Optional note for the treasurer, such as branch name or sender name."></textarea>
          </label>

          <div class="alert alert-info">
            <span class="material-symbols-outlined">info</span>
            <div>
              <strong>Upload proof after sending payment.</strong>
              <p>Accepted proof includes screenshots, bank slips, official receipt photos, or PDF confirmations.</p>
            </div>
          </div>

          <label class="upload-zone mb-4" id="proofUploadZone">
            <input id="proofFile" name="proofFile" type="file" accept="image/*,.pdf" hidden ${canPay ? 'required' : ''}>
            <span class="material-symbols-outlined upload-zone-icon">upload_file</span>
            <div id="proofFileLabel">Upload proof of payment</div>
            <small>Accepted: image or PDF file</small>
          </label>

          <div class="payment-review mb-4">
            <div>
              <span>Selected Method</span>
              <strong id="selectedPaymentMethod">${escapeHtml(methods[0].label)}</strong>
            </div>
            <div>
              <span>Total to Pay</span>
              <strong>${formatCurrency(totalAmount)}</strong>
            </div>
          </div>

          <button class="btn btn-primary btn-block" type="submit" ${canPay ? '' : 'disabled'}>
            <span class="material-symbols-outlined">payments</span>
            Submit Payment
          </button>
        </div>
      </form>
    </div>
  `;

  bindPaymentForm({ application, canPay, methods, proofFile: document.getElementById('proofFile'), totalAmount, user });
}

function bindPaymentForm({ application, canPay, methods, proofFile, totalAmount, user }) {
  const methodInputs = [...document.querySelectorAll('input[name="method"]')];
  const instructions = document.getElementById('paymentInstructions');
  const selectedMethodLabel = document.getElementById('selectedPaymentMethod');
  const otherMethodGroup = document.getElementById('otherMethodGroup');
  const otherMethodInput = document.getElementById('otherPaymentMethod');
  const paymentRefLabel = document.getElementById('paymentRefLabel');
  const payerAccountLabel = document.getElementById('payerAccountLabel');
  const transactionReference = document.getElementById('transactionReference');
  const payerAccount = document.getElementById('payerAccount');

  const selectedMethod = () => methods.find(method => method.id === document.querySelector('input[name="method"]:checked')?.value) || methods[0];
  const syncMethod = () => {
    const method = selectedMethod();
    document.querySelectorAll('.payment-method-card').forEach(card => {
      card.classList.toggle('selected', card.querySelector('input')?.checked);
    });
    instructions.innerHTML = renderPaymentInstructions(method);
    selectedMethodLabel.textContent = method.label;
    otherMethodGroup.hidden = method.id !== 'other';
    otherMethodInput.required = canPay && method.id === 'other';
    paymentRefLabel.textContent = method.referenceLabel || 'Transaction Reference';
    payerAccountLabel.textContent = method.accountLabel || 'Account / Mobile Number';
    transactionReference.placeholder = method.referencePlaceholder || 'Reference number';
    payerAccount.placeholder = method.accountPlaceholder || 'Optional';
  };

  methodInputs.forEach(input => input.addEventListener('change', syncMethod));
  syncMethod();

  proofFile.addEventListener('change', () => {
    document.getElementById('proofFileLabel').textContent = proofFile.files[0]?.name || 'Upload proof of payment';
  });

  document.getElementById('paymentForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!canPay) return;

    const data = new FormData(event.currentTarget);
    const method = selectedMethod();
    const file = proofFile.files[0];
    const providerName = method.id === 'other' ? String(data.get('otherPaymentMethod') || '').trim() : method.label;
    const referenceValue = String(data.get('transactionReference') || '').trim();

    if (!providerName) {
      showToast('Enter the payment provider name.', 'warning');
      return;
    }
    if (!referenceValue) {
      showToast('Enter the transaction reference number.', 'warning');
      return;
    }
    if (!file) {
      showToast('Upload proof of payment before submitting.', 'warning');
      return;
    }

    showLoader();
    try {
      const paymentId = await createPayment({
        applicationId: application.id,
        userId: user.uid,
        citizenName: user.fullName || user.email || 'Citizen',
        amount: totalAmount,
        method: providerName,
        paymentMethodId: method.id,
        paymentChannel: method.channel,
        transactionReference: referenceValue,
        payerAccount: String(data.get('payerAccount') || '').trim(),
        paymentNotes: String(data.get('paymentNotes') || '').trim(),
        paymentDestination: method.destination,
        serviceName: application.serviceName || 'Municipal Service',
        status: 'pending',
        skipApplicationStatusUpdate: true
      });
      const proofUrl = await uploadPaymentProof(paymentId, file);
      await updatePaymentProof(paymentId, proofUrl, file.name);
      await updateApplicationStatus(application.id, 'paymentPending', `Payment proof submitted via ${providerName}.`);
      showToast('Payment submitted for confirmation.', 'success');
      location.href = `/citizen/payment-confirmation.html?payId=${paymentId}`;
    } catch (error) {
      console.error('Payment submit error:', error);
      showToast(error.message || 'Unable to submit payment.', 'error');
    } finally {
      hideLoader();
    }
  });
}

function renderPaymentInstructions(method) {
  return `
    <div class="payment-instruction-head">
      <span class="material-symbols-outlined">${escapeHtml(method.icon)}</span>
      <div>
        <strong>${escapeHtml(method.label)}</strong>
        <small>${escapeHtml(method.channel)}</small>
      </div>
    </div>
    <dl class="details-list payment-destination-list">
      ${paymentDetailsRow('Pay To', method.destination)}
      ${paymentDetailsRow('Instructions', method.instructions)}
      ${method.feeNote ? paymentDetailsRow('Note', method.feeNote) : ''}
    </dl>
  `;
}

async function getPaymentSettings() {
  try {
    return await getAppSettings();
  } catch (error) {
    console.warn('Payment settings fallback:', error);
    return defaultAppSettings();
  }
}

function paymentMethods(settings = defaultAppSettings()) {
  const bankDestination = `${settings.bankName || 'Municipal Bank Account'} - ${settings.bankAccountNumber || 'Contact Treasury'}`;
  return [
    {
      id: 'gcash',
      label: 'GCash',
      channel: 'E-wallet',
      icon: 'account_balance_wallet',
      short: 'Pay using GCash transfer',
      destination: settings.gcashMerchant || 'Kabacan Municipal Treasurer',
      instructions: 'Open GCash, send the exact amount to the municipal merchant, then upload the payment screenshot.',
      referenceLabel: 'GCash Reference No.',
      referencePlaceholder: 'Example: 1001 234 567890',
      accountLabel: 'GCash Mobile Number',
      accountPlaceholder: '09XXXXXXXXX'
    },
    {
      id: 'maya',
      label: 'Maya',
      channel: 'E-wallet',
      icon: 'account_balance_wallet',
      short: 'Pay using Maya wallet',
      destination: settings.mayaMerchant || 'Kabacan Municipal Treasurer',
      instructions: 'Open Maya, send the exact amount to the municipal merchant, then upload the payment screenshot.',
      referenceLabel: 'Maya Reference No.',
      referencePlaceholder: 'Example: 202605210001',
      accountLabel: 'Maya Mobile Number',
      accountPlaceholder: '09XXXXXXXXX'
    },
    {
      id: 'gotyme',
      label: 'GoTyme Bank',
      channel: 'Digital bank',
      icon: 'account_balance',
      short: 'Transfer from GoTyme',
      destination: bankDestination,
      instructions: 'Use GoTyme bank transfer to the municipal bank account and upload the successful transfer receipt.',
      referenceLabel: 'GoTyme Transfer Ref.',
      referencePlaceholder: 'Transfer reference number',
      accountLabel: 'Sender Account Name',
      accountPlaceholder: 'Name shown on transfer'
    },
    {
      id: 'landbank',
      label: 'LandBank Link.BizPortal',
      channel: 'Online banking',
      icon: 'language',
      short: 'Pay through LandBank portal',
      destination: 'Municipal Treasurer payment facility',
      instructions: 'Complete the LandBank Link.BizPortal transaction and upload the confirmation slip.',
      referenceLabel: 'Link.BizPortal Ref.',
      referencePlaceholder: 'Reference / trace number',
      accountLabel: 'Payer Name',
      accountPlaceholder: 'Name used in portal'
    },
    {
      id: 'bank',
      label: 'Bank Transfer',
      channel: 'Bank deposit or transfer',
      icon: 'account_balance',
      short: 'BDO, BPI, UnionBank, or other banks',
      destination: bankDestination,
      instructions: 'Transfer or deposit the exact amount to the municipal bank account and upload the deposit slip or transfer receipt.',
      referenceLabel: 'Bank Reference No.',
      referencePlaceholder: 'Deposit slip / transfer number',
      accountLabel: 'Sender Bank / Account',
      accountPlaceholder: 'Example: BPI - Juan Dela Cruz'
    },
    {
      id: 'card',
      label: 'Debit / Credit Card',
      channel: 'Card payment',
      icon: 'credit_card',
      short: 'Attach card confirmation',
      destination: 'Municipal online card payment facility',
      instructions: 'Pay using your card through the approved payment facility, then upload the confirmation receipt.',
      referenceLabel: 'Card Transaction ID',
      referencePlaceholder: 'Authorization / transaction ID',
      accountLabel: 'Cardholder Name',
      accountPlaceholder: 'Name on card'
    },
    {
      id: 'counter',
      label: 'Over-the-Counter',
      channel: 'Municipal cashier',
      icon: 'point_of_sale',
      short: 'Pay at the treasury counter',
      destination: 'Municipal Treasurer Office',
      instructions: 'Pay at the municipal cashier and upload the official receipt or claim stub.',
      referenceLabel: 'Official Receipt No.',
      referencePlaceholder: 'OR number',
      accountLabel: 'Cashier / Branch',
      accountPlaceholder: 'Optional'
    },
    {
      id: 'other',
      label: 'Other',
      channel: 'Other provider',
      icon: 'more_horiz',
      short: 'Use another approved method',
      destination: 'As instructed by the Municipal Treasurer',
      instructions: 'Enter the provider used, then upload a clear proof of payment for treasury confirmation.',
      referenceLabel: 'Reference No.',
      referencePlaceholder: 'Reference number',
      accountLabel: 'Account / Sender Details',
      accountPlaceholder: 'Optional'
    }
  ];
}

function paymentDetailsRow(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value ?? 'N/A')}</dd></div>`;
}
