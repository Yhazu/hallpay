/* /assets/js/pages/settings.js */
document.addEventListener('DOMContentLoaded', async () => {
  const role = document.body.dataset.role || 'citizen';
  await requireAuth([role]);
  if (window.renderSidebar) await renderSidebar(role);
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: role.charAt(0).toUpperCase() + role.slice(1), href: `/${role}/dashboard.html` }, { label: 'Settings' }]);

  const mount = document.querySelector('[data-page-module]');
  if (role === 'admin') {
    renderAdminSettingsPage(mount, await getAppSettings());
    return;
  }

  renderSettingsPage(mount);
});

function getSetting(key, fallback) {
  const raw = localStorage.getItem(`hallpay:${key}`);
  return raw === null ? fallback : JSON.parse(raw);
}

function setSetting(key, value) {
  localStorage.setItem(`hallpay:${key}`, JSON.stringify(value));
}

function renderSettingsPage(mount) {
  const theme = localStorage.getItem('theme') || 'light';
  const notifications = getSetting('notifications', {
    applicationUpdates: true,
    paymentReminders: true,
    announcements: true,
    supportReplies: true
  });

  mount.innerHTML = `
    <div class="settings-grid">
      <section class="card">
        <div class="card-header"><h2 class="card-title">Appearance</h2></div>
        <div class="card-body">
          ${['light', 'dark', 'system'].map(option => `
            <label class="switch">
              <span>${option.charAt(0).toUpperCase() + option.slice(1)}</span>
              <input type="radio" name="theme" value="${option}" ${theme === option ? 'checked' : ''}>
            </label>
          `).join('')}
        </div>
      </section>

      <section class="card">
        <div class="card-header"><h2 class="card-title">Notifications</h2></div>
        <div class="card-body">
          ${[
            ['applicationUpdates', 'Application updates'],
            ['paymentReminders', 'Payment reminders'],
            ['announcements', 'Announcements'],
            ['supportReplies', 'Support replies']
          ].map(([key, label]) => `
            <label class="switch">
              <span>${label}</span>
              <input type="checkbox" data-notification="${key}" ${notifications[key] ? 'checked' : ''}>
            </label>
          `).join('')}
        </div>
      </section>

      <section class="card">
        <div class="card-header"><h2 class="card-title">Privacy</h2></div>
        <div class="card-body">
          <p><a href="/privacy-policy.html" target="_blank" rel="noopener">View Privacy Policy</a></p>
          <p><a href="/terms-of-service.html" target="_blank" rel="noopener">View Terms of Service</a></p>
        </div>
      </section>

      <section class="card">
        <div class="card-header"><h2 class="card-title">About</h2></div>
        <div class="card-body">
          <p><strong>App version:</strong> 1.0.0</p>
          <p><strong>Build:</strong> HALL-PAY Web</p>
          <p><strong>Contact:</strong> <a href="mailto:hallpay@kabacan.gov.ph">hallpay@kabacan.gov.ph</a></p>
        </div>
      </section>
    </div>
  `;

  document.querySelectorAll('input[name="theme"]').forEach(input => {
    input.addEventListener('change', () => {
      localStorage.setItem('theme', input.value);
      const resolved = input.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : input.value;
      document.documentElement.dataset.theme = resolved;
      showToast('Theme preference saved.', 'success');
    });
  });

  document.querySelectorAll('[data-notification]').forEach(input => {
    input.addEventListener('change', () => {
      notifications[input.dataset.notification] = input.checked;
      setSetting('notifications', notifications);
      showToast('Notification preferences saved.', 'success');
    });
  });
}

function renderAdminSettingsPage(mount, settings) {
  const theme = localStorage.getItem('theme') || 'light';

  mount.innerHTML = `
    <form id="adminSettingsForm">
      <div class="settings-admin-layout">
        <section class="card settings-admin-card">
          <div class="card-header">
            <h2 class="card-title">Municipality Profile</h2>
            <span class="badge badge-submitted">Public</span>
          </div>
          <div class="card-body">
            <div class="grid-2">
              ${adminInput('municipality', 'Municipality Name', settings.municipality, true)}
              ${adminInput('province', 'Province', settings.province, true)}
            </div>
            ${adminInput('officeAddress', 'Office Address', settings.officeAddress, true)}
            <div class="grid-2">
              ${adminInput('contactEmail', 'Contact Email', settings.contactEmail, true, 'email')}
              ${adminInput('contactPhone', 'Contact Phone', settings.contactPhone, true)}
            </div>
            <div class="grid-2">
              ${adminInput('mayorName', 'Mayor Name', settings.mayorName, true)}
              ${adminInput('treasurerName', 'Treasurer Name', settings.treasurerName, true)}
            </div>
            ${adminInput('businessHours', 'Business Hours', settings.businessHours)}
          </div>
        </section>

        <section class="card settings-admin-card">
          <div class="card-header">
            <h2 class="card-title">Workflow Defaults</h2>
            <span class="badge badge-ready">Applications</span>
          </div>
          <div class="card-body">
            <div class="grid-2">
              ${adminInput('defaultProcessingDays', 'Default Processing Days', settings.defaultProcessingDays, true, 'number', 1)}
              ${adminInput('paymentGraceDays', 'Payment Grace Days', settings.paymentGraceDays, true, 'number', 0)}
            </div>
            <div class="grid-2">
              ${adminInput('receiptPrefix', 'Receipt Prefix', settings.receiptPrefix, true)}
              ${adminInput('permitPrefix', 'Permit Prefix', settings.permitPrefix, true)}
            </div>
            ${adminToggle('autoApproveReceipts', 'Auto-confirm mock receipts', settings.autoApproveReceipts)}
            ${adminToggle('enableQrVerification', 'Enable public QR verification', settings.enableQrVerification)}
          </div>
        </section>

        <section class="card settings-admin-card">
          <div class="card-header">
            <h2 class="card-title">Payment Channels</h2>
            <span class="badge badge-paid">Treasury</span>
          </div>
          <div class="card-body">
            ${adminInput('gcashMerchant', 'GCash Merchant Name', settings.gcashMerchant)}
            ${adminInput('mayaMerchant', 'Maya Merchant Name', settings.mayaMerchant)}
            <div class="grid-2">
              ${adminInput('bankName', 'Bank Name', settings.bankName)}
              ${adminInput('bankAccountNumber', 'Bank Account Number', settings.bankAccountNumber)}
            </div>
          </div>
        </section>

        <section class="card settings-admin-card">
          <div class="card-header">
            <h2 class="card-title">Access & Notifications</h2>
            <span class="badge badge-under-review">System</span>
          </div>
          <div class="card-body">
            ${adminToggle('allowPublicRegistration', 'Allow public citizen registration', settings.allowPublicRegistration)}
            ${adminToggle('requireEmailVerification', 'Require email verification', settings.requireEmailVerification)}
            ${adminToggle('enableEmailNotifications', 'Enable email notification queue', settings.enableEmailNotifications)}
            ${adminToggle('enableSmsNotifications', 'Enable SMS notification queue', settings.enableSmsNotifications)}
            ${adminToggle('maintenanceMode', 'Maintenance mode', settings.maintenanceMode, 'Blocks non-admin workflows when enforced by rules.')}
          </div>
        </section>

        <section class="card settings-admin-card">
          <div class="card-header">
            <h2 class="card-title">Legal Links</h2>
          </div>
          <div class="card-body">
            ${adminInput('privacyPolicyUrl', 'Privacy Policy URL', settings.privacyPolicyUrl)}
            ${adminInput('termsUrl', 'Terms of Service URL', settings.termsUrl)}
          </div>
        </section>

        <section class="card settings-admin-card">
          <div class="card-header">
            <h2 class="card-title">Admin Preferences</h2>
          </div>
          <div class="card-body">
            ${['light', 'dark', 'system'].map(option => `
              <label class="switch">
                <span>${option.charAt(0).toUpperCase() + option.slice(1)} theme</span>
                <input type="radio" name="themePreference" value="${option}" ${theme === option ? 'checked' : ''}>
              </label>
            `).join('')}
            <div class="settings-health-panel">
              <div><strong>Firebase</strong><span>${isFirebaseConfigured() ? 'Connected' : 'Demo mode'}</span></div>
              <div><strong>Project</strong><span>${escapeHtml(firebaseConfig.projectId || 'Not configured')}</span></div>
              <div><strong>Last Updated</strong><span>${settings.updatedAt ? formatDateTime(settings.updatedAt) : 'Not saved yet'}</span></div>
            </div>
          </div>
        </section>
      </div>

      <div class="settings-sticky-actions">
        <button class="btn btn-secondary" type="button" id="resetAdminSettings"><span class="material-symbols-outlined">restart_alt</span>Reset Demo Defaults</button>
        <button class="btn btn-primary" type="submit"><span class="material-symbols-outlined">save</span>Save Settings</button>
      </div>
    </form>
  `;

  document.querySelectorAll('input[name="themePreference"]').forEach(input => {
    input.addEventListener('change', () => {
      localStorage.setItem('theme', input.value);
      const resolved = input.value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : input.value;
      document.documentElement.dataset.theme = resolved;
      showToast('Theme preference saved.', 'success');
    });
  });

  document.getElementById('resetAdminSettings').addEventListener('click', () => {
    confirmDialog('Reset the admin settings form back to the Kabacan demo defaults?', () => {
      localStorage.removeItem('hallpay:adminSettings');
      renderAdminSettingsPage(mount, defaultAdminSettingsFallback());
      showToast('Settings reset to demo defaults.', 'success');
    });
  });

  document.getElementById('adminSettingsForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const payload = {
      municipality: data.municipality.trim(),
      province: data.province.trim(),
      officeAddress: data.officeAddress.trim(),
      contactEmail: data.contactEmail.trim(),
      contactPhone: data.contactPhone.trim(),
      mayorName: data.mayorName.trim(),
      treasurerName: data.treasurerName.trim(),
      businessHours: data.businessHours.trim(),
      receiptPrefix: data.receiptPrefix.trim().toUpperCase(),
      permitPrefix: data.permitPrefix.trim().toUpperCase(),
      defaultProcessingDays: Number(data.defaultProcessingDays),
      paymentGraceDays: Number(data.paymentGraceDays),
      gcashMerchant: data.gcashMerchant.trim(),
      mayaMerchant: data.mayaMerchant.trim(),
      bankName: data.bankName.trim(),
      bankAccountNumber: data.bankAccountNumber.trim(),
      privacyPolicyUrl: data.privacyPolicyUrl.trim(),
      termsUrl: data.termsUrl.trim(),
      autoApproveReceipts: form.autoApproveReceipts.checked,
      enableQrVerification: form.enableQrVerification.checked,
      allowPublicRegistration: form.allowPublicRegistration.checked,
      requireEmailVerification: form.requireEmailVerification.checked,
      enableEmailNotifications: form.enableEmailNotifications.checked,
      enableSmsNotifications: form.enableSmsNotifications.checked,
      maintenanceMode: form.maintenanceMode.checked
    };

    if (!validateEmail(payload.contactEmail)) {
      showToast('Please enter a valid contact email.', 'error');
      form.contactEmail.focus();
      return;
    }

    if (payload.defaultProcessingDays < 1 || payload.paymentGraceDays < 0) {
      showToast('Workflow day values are outside the allowed range.', 'error');
      return;
    }

    showLoader();
    try {
      await updateAppSettings(payload);
      showToast('Admin settings saved.', 'success');
      renderAdminSettingsPage(mount, { ...settings, ...payload, updatedAt: new Date() });
    } catch (error) {
      showToast(error.message || 'Unable to save admin settings.', 'error');
    } finally {
      hideLoader();
    }
  });
}

function adminInput(name, label, value = '', required = false, type = 'text', min = null) {
  return `
    <label class="form-group">
      <span class="form-label ${required ? 'required' : ''}">${label}</span>
      <input class="form-control" type="${type}" name="${name}" value="${escapeHtml(value)}" ${required ? 'required' : ''} ${min !== null ? `min="${min}"` : ''}>
    </label>
  `;
}

function adminToggle(name, label, checked = false, hint = '') {
  return `
    <label class="switch settings-toggle-row">
      <span>${label}${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</span>
      <input type="checkbox" name="${name}" ${checked ? 'checked' : ''}>
    </label>
  `;
}

function defaultAdminSettingsFallback() {
  return {
    municipality: 'Municipality of Kabacan',
    province: 'North Cotabato',
    officeAddress: 'Municipal Hall, Kabacan, North Cotabato',
    contactEmail: 'hallpay@kabacan.gov.ph',
    contactPhone: '(064) 248-0000',
    mayorName: 'Municipal Mayor',
    treasurerName: 'Municipal Treasurer',
    businessHours: 'Monday to Friday, 8:00 AM - 5:00 PM',
    receiptPrefix: 'RCP',
    permitPrefix: 'KBC',
    defaultProcessingDays: 5,
    paymentGraceDays: 7,
    autoApproveReceipts: false,
    allowPublicRegistration: true,
    requireEmailVerification: true,
    maintenanceMode: false,
    enableQrVerification: true,
    enableEmailNotifications: true,
    enableSmsNotifications: false,
    gcashMerchant: 'Kabacan Municipal Treasurer',
    mayaMerchant: 'Kabacan Municipal Treasurer',
    bankName: 'BDO / BPI Municipal Account',
    bankAccountNumber: '0000-0000-0000',
    privacyPolicyUrl: '/privacy-policy.html',
    termsUrl: '/terms-of-service.html'
  };
}
