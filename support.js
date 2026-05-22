/* /assets/js/pages/support.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['citizen']);
  if (window.renderSidebar) await renderSidebar('citizen');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Citizen', href: '/citizen/dashboard.html' }, { label: 'Help & Support' }]);

  const mount = document.querySelector('[data-page-module]');
  const state = {
    activeTab: 'faq',
    applications: await getUserApplications(window.currentUser.uid),
    tickets: await getUserTickets(window.currentUser.uid)
  };
  renderSupportPage(mount, state);
});

function ticketBadge(status) {
  const classes = { open: 'badge-open', in_progress: 'badge-in-progress', resolved: 'badge-resolved', closed: 'badge-closed' };
  return `<span class="badge ${classes[status] || 'badge-open'}">${String(status || 'open').replace('_', ' ')}</span>`;
}

function renderSupportPage(mount, state) {
  mount.innerHTML = `
    <div class="tabs">
      ${[
        ['faq', 'FAQ'],
        ['contact', 'Contact Us'],
        ['ticket', 'Submit Ticket'],
        ['mine', 'My Tickets']
      ].map(([id, label]) => `<button class="tab-btn ${state.activeTab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
    </div>
    <section id="supportPanel"></section>
    <div class="modal-overlay" id="ticketModal" hidden>
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title" id="ticketModalTitle">Ticket</h2>
          <button class="modal-close" data-close="ticketModal"><span class="material-symbols-outlined">close</span></button>
        </div>
        <div class="modal-body" id="ticketModalBody"></div>
      </div>
    </div>
  `;

  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      state.activeTab = button.dataset.tab;
      renderSupportPage(mount, state);
    });
  });

  renderSupportPanel(state);
}

function renderSupportPanel(state) {
  const panel = document.getElementById('supportPanel');

  if (state.activeTab === 'faq') {
    const faqs = [
      ['How do I apply for a service?', 'Open Services, choose a service, then complete the application form and document upload steps.'],
      ['How do I pay assessed fees?', 'Open your application details or Transaction History, then use the Pay action when the application is marked for payment.'],
      ['Can I replace uploaded documents?', 'Yes. Use Upload Documents or open the application details and choose the resubmit action when available.'],
      ['How long does processing take?', 'Processing time depends on the service. Each service card shows its estimated business days.'],
      ['Where can I find my receipt?', 'Receipts appear in Transaction History after a payment is confirmed.'],
      ['How do I verify a permit or receipt?', 'Use the QR verification page and scan or paste the HALL-PAY code.'],
      ['Why is my application rejected?', 'Open Application Details to read staff remarks and resubmit corrected requirements.'],
      ['Who can help with payment issues?', 'Submit a support ticket under Payment Issue or contact the municipal treasurer office.']
    ];
    panel.innerHTML = `<div class="card"><div class="card-body support-faq-list">${faqs.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></div>`;
    return;
  }

  if (state.activeTab === 'contact') {
    panel.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h2 class="card-title">Municipal Help Desk</h2></div>
          <div class="card-body">
            <p><strong>Phone:</strong> <a href="tel:+63642480000">(064) 248-0000</a></p>
            <p><strong>Email:</strong> <a href="mailto:hallpay@kabacan.gov.ph">hallpay@kabacan.gov.ph</a></p>
            <p><strong>Address:</strong> Municipal Hall, Kabacan, North Cotabato</p>
            <p><strong>Office Hours:</strong> Monday to Friday, 8:00 AM - 5:00 PM</p>
          </div>
        </div>
        <div class="card"><div class="card-body"><div class="map-placeholder">Municipal Hall Map</div></div></div>
      </div>
    `;
    return;
  }

  if (state.activeTab === 'ticket') {
    panel.innerHTML = `
      <form class="card" id="supportTicketForm">
        <div class="card-header"><h2 class="card-title">Submit Ticket</h2></div>
        <div class="card-body">
          <label class="form-group"><span class="form-label required">Subject</span><input class="form-control" name="subject" required></label>
          <label class="form-group"><span class="form-label">Related Application</span><select class="form-control" name="applicationId"><option value="">None</option>${state.applications.map(app => `<option value="${app.id}">${app.referenceNumber} - ${app.serviceName}</option>`).join('')}</select></label>
          <label class="form-group"><span class="form-label required">Category</span><select class="form-control" name="category" required><option>Technical Issue</option><option>Payment Issue</option><option>General Inquiry</option><option>Other</option></select></label>
          <label class="form-group"><span class="form-label required">Message</span><textarea class="form-control" name="message" minlength="20" required></textarea><span class="form-hint">Minimum 20 characters.</span></label>
          <label class="upload-zone mb-4"><input type="file" name="screenshot" hidden><span class="material-symbols-outlined upload-zone-icon">upload_file</span><div>Attach screenshot</div><small>Optional</small></label>
          <button class="btn btn-primary">Submit Ticket</button>
        </div>
      </form>
    `;

    document.getElementById('supportTicketForm').addEventListener('submit', async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      if (String(data.message || '').trim().length < 20) {
        showToast('Please provide at least 20 characters in the message.', 'warning');
        return;
      }
      showLoader();
      try {
        const file = event.currentTarget.screenshot.files[0];
        const attachmentUrl = file ? await uploadFile(file, `support/${window.currentUser.uid}/${Date.now()}-${file.name}`) : null;
        const payload = { ...data, userId: window.currentUser.uid, attachmentUrl, attachmentFileName: file?.name || null };
        const id = await createSupportTicket(payload);
        state.tickets.unshift({ id, ...payload, status: 'open', createdAt: new Date(), updatedAt: new Date() });
        showToast('Support ticket submitted.', 'success');
        state.activeTab = 'mine';
        renderSupportPage(document.querySelector('[data-page-module]'), state);
      } catch (error) {
        showToast(error.message || 'Unable to submit ticket.', 'error');
      } finally {
        hideLoader();
      }
    });
    return;
  }

  panel.innerHTML = `
    ${state.tickets.length ? `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Ticket #</th><th>Subject</th><th>Status</th><th>Date</th><th>Last Update</th><th>View</th></tr></thead>
          <tbody>
            ${state.tickets.map(ticket => `
              <tr>
                <td>${escapeHtml(ticket.id)}</td>
                <td>${escapeHtml(ticket.subject)}</td>
                <td>${ticketBadge(ticket.status)}</td>
                <td>${formatDate(ticket.createdAt)}</td>
                <td>${formatDate(ticket.updatedAt || ticket.createdAt)}</td>
                <td><button class="btn btn-sm btn-secondary" data-view-ticket="${ticket.id}">View</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : `
      <div class="empty-state card">
        <span class="material-symbols-outlined empty-state-icon">support_agent</span>
        <h2 class="empty-state-title">No tickets yet</h2>
        <p class="empty-state-text">Submit a ticket when you need help with an application or payment.</p>
      </div>
    `}
  `;

  document.querySelectorAll('[data-view-ticket]').forEach(button => {
    button.addEventListener('click', () => {
      const ticket = state.tickets.find(item => item.id === button.dataset.viewTicket);
      document.getElementById('ticketModalTitle').textContent = ticket.subject;
      document.getElementById('ticketModalBody').innerHTML = `
        <p><strong>Status:</strong> ${ticketBadge(ticket.status)}</p>
        <p><strong>Category:</strong> ${escapeHtml(ticket.category || 'General Inquiry')}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(ticket.message || '')}</p>
        ${ticket.attachmentUrl ? `<a class="btn btn-secondary" href="${ticket.attachmentUrl}" target="_blank"><span class="material-symbols-outlined">attach_file</span>View attachment</a>` : ''}
        <div class="alert alert-info">A municipal support officer will respond here once available.</div>
      `;
      openModal('ticketModal');
    });
  });
}
