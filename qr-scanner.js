/* /assets/js/qr-scanner.js */
let hallpayScanner = null;

async function startQRScanner(id, onResult) {
  if (!window.Html5Qrcode) throw new Error('QR scanner library not loaded.');
  await stopQRScanner();
  hallpayScanner = new Html5Qrcode(id);
  await hallpayScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: 250 },
    async text => {
      await stopQRScanner();
      onResult(text);
    }
  );
}

async function scanQRImage(id, file) {
  if (!window.Html5Qrcode) throw new Error('QR scanner library not loaded.');
  if (!file) throw new Error('Select a QR image first.');
  await stopQRScanner();
  const scanner = new Html5Qrcode(id);
  try {
    return await scanner.scanFile(file, true);
  } finally {
    scanner.clear();
  }
}

async function stopQRScanner() {
  if (hallpayScanner) {
    await hallpayScanner.stop().catch(() => {});
    hallpayScanner.clear();
    hallpayScanner = null;
  }
}
