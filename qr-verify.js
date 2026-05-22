/* /assets/js/pages/qr-verify.js */
document.addEventListener('DOMContentLoaded', () => {
  const result = document.getElementById('verifyResult');
  const input = document.getElementById('qrInput');
  const verifyBtn = document.getElementById('verifyBtn');
  const startScanBtn = document.getElementById('startScan');
  const imageInput = document.getElementById('qrImageInput');

  const renderMessage = (message, type = 'info') => {
    result.innerHTML = `
      <div class="alert alert-${type}">
        ${escapeHtml(message)}
      </div>`;
  };

  const show = async code => {
    const value = String(code || '').trim();
    if (!value) {
      renderMessage('Enter or scan a HALL-PAY QR code.', 'warning');
      return;
    }

    verifyBtn.disabled = true;
    startScanBtn.disabled = true;
    imageInput.disabled = true;
    result.innerHTML = '<div class="skeleton" style="height:160px"></div>';

    try {
      const r = await verifyQRData(value);
      const statusClass = r.valid ? 'badge-approved' : 'badge-rejected';
      const message = r.message ? `<div class="alert alert-warning mt-4">${escapeHtml(r.message)}</div>` : '';
      const title = r.valid && !r.message ? 'Verified HALL-PAY Record' : r.valid ? 'Readable HALL-PAY QR' : 'Verification Failed';

      result.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">${title}</h2>
            <span class="badge ${statusClass}">${escapeHtml(r.status || 'INVALID')}</span>
          </div>
          <div class="card-body">
            <p><strong>Document Type:</strong> ${escapeHtml(r.type || 'Unknown')}</p>
            <p><strong>Document Number:</strong> ${escapeHtml(r.number || value)}</p>
            <p><strong>Issued to:</strong> ${escapeHtml(r.issuedTo || 'N/A')}</p>
            <p><strong>Issue Date:</strong> ${r.issueDate ? escapeHtml(formatDate(r.issueDate)) : 'N/A'}</p>
            ${r.validUntil ? `<p><strong>Valid Until:</strong> ${escapeHtml(formatDate(r.validUntil))}</p>` : ''}
            ${message}
          </div>
        </div>`;
    } catch (error) {
      console.error(error);
      renderMessage('Unable to verify this QR code right now. Please try again.', 'danger');
    } finally {
      verifyBtn.disabled = false;
      startScanBtn.disabled = false;
      imageInput.disabled = false;
    }
  };

  document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(tab => tab.classList.remove('active'));
      button.classList.add('active');
      document.getElementById('scanPanel').hidden = button.dataset.tab !== 'scan';
      document.getElementById('manualPanel').hidden = button.dataset.tab !== 'manual';
    });
  });

  verifyBtn.addEventListener('click', () => show(input.value));
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') show(input.value);
  });

  startScanBtn.addEventListener('click', () => {
    startQRScanner('qrReader', text => {
      input.value = text;
      show(text);
    }).catch(error => showToast(error.message, 'error'));
  });

  imageInput.addEventListener('change', async () => {
    try {
      const text = await scanQRImage('qrReader', imageInput.files[0]);
      input.value = text;
      show(text);
    } catch (error) {
      showToast(error.message || 'Unable to read that QR image.', 'error');
    } finally {
      imageInput.value = '';
    }
  });

  const code = getQueryParam('code') || getQueryParam('data');
  if (code) {
    input.value = code;
    show(code);
  }
});
