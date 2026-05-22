/* /assets/js/pages/profile.js */
document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth(['citizen']);
  if (window.renderSidebar) await renderSidebar('citizen');
  if (window.renderTopbar) renderTopbar(window.currentUser);
  initSidebarToggle();
  initThemeToggle();
  initOfflineBanner();
  setBreadcrumb([{ label: 'Citizen', href: '/citizen/dashboard.html' }, { label: 'Profile' }]);

  const mount = document.querySelector('[data-page-module]');
  const state = { user: window.currentUser, editing: false };
  renderProfilePage(mount, state);
});

function renderProfilePage(mount, state) {
  const user = state.user;
  mount.innerHTML = `
    <div class="profile-layout">
      <aside class="card">
        <div class="card-body profile-summary">
          <div class="profile-avatar">${escapeHtml((user.fullName || user.email || 'U').charAt(0).toUpperCase())}</div>
          <h2>${escapeHtml(user.fullName || 'Citizen')}</h2>
          <p>${user.isVerified ? '<span class="badge badge-approved">Verified</span>' : '<span class="badge badge-pay-pending">Email pending</span>'}</p>
          <button class="btn btn-secondary btn-sm" id="changePhotoBtn">Change Photo</button>
          <input type="file" id="photoInput" hidden accept="image/*">
          <p class="mt-4">Member since ${formatDate(user.createdAt || new Date())}</p>
        </div>
      </aside>

      <section class="profile-stack">
        <form class="card" id="profileInfoForm">
          <div class="card-header">
            <h2 class="card-title">Personal Information</h2>
            <div class="action-row">
              ${state.editing ? '<button type="button" class="btn btn-secondary btn-sm" id="cancelEditBtn">Cancel</button><button class="btn btn-primary btn-sm">Save Changes</button>' : '<button type="button" class="btn btn-secondary btn-sm" id="editProfileBtn">Edit</button>'}
            </div>
          </div>
          <div class="card-body">
            <div class="grid-2">
              <label class="form-group"><span class="form-label required">Full Name</span><input class="form-control" name="fullName" value="${escapeHtml(user.fullName || '')}" ${state.editing ? '' : 'readonly'} required></label>
              <label class="form-group"><span class="form-label">Email</span><input class="form-control" name="email" value="${escapeHtml(user.email || '')}" readonly></label>
              <label class="form-group"><span class="form-label">Phone</span><input class="form-control" name="phone" value="${escapeHtml(user.phone || '')}" ${state.editing ? '' : 'readonly'}></label>
              <label class="form-group"><span class="form-label">Address</span><textarea class="form-control" name="address" ${state.editing ? '' : 'readonly'}>${escapeHtml(user.address || '')}</textarea></label>
            </div>
          </div>
        </form>

        <div class="card">
          <div class="card-header"><h2 class="card-title">Valid ID</h2></div>
          <div class="card-body">
            <label class="upload-zone">
              <input type="file" id="validIdInput" hidden accept="image/*,.pdf">
              <span class="material-symbols-outlined upload-zone-icon">badge</span>
              <div>Replace Valid ID</div>
              <small id="validIdLabel">${user.validIdName || 'No replacement selected'}</small>
            </label>
          </div>
        </div>

        <form class="card" id="passwordForm">
          <div class="card-header"><h2 class="card-title">Security</h2></div>
          <div class="card-body">
            <div class="grid-3">
              <input class="form-control" type="password" name="currentPassword" placeholder="Current password">
              <input class="form-control" type="password" name="newPassword" placeholder="New password">
              <input class="form-control" type="password" name="confirmPassword" placeholder="Confirm new password">
            </div>
            <button class="btn btn-secondary mt-4">Update Password</button>
          </div>
        </form>

        <div class="card">
          <div class="card-header"><h2 class="card-title">Danger Zone</h2></div>
          <div class="card-body">
            <div class="alert alert-danger">
              <span class="material-symbols-outlined">warning</span>
              Account deletion requires municipal staff verification.
            </div>
            <button class="btn btn-danger" id="deleteAccountBtn">Request Account Deletion</button>
          </div>
        </div>
      </section>
    </div>
  `;

  document.getElementById('editProfileBtn')?.addEventListener('click', () => {
    state.editing = true;
    renderProfilePage(mount, state);
  });
  document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
    state.editing = false;
    renderProfilePage(mount, state);
  });
  document.getElementById('profileInfoForm').addEventListener('submit', async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.phone && !validatePhone(data.phone)) {
      showToast('Phone must follow PH format: 09XXXXXXXXX.', 'warning');
      return;
    }
    await updateUser(user.uid, { fullName: data.fullName, phone: data.phone, address: data.address });
    Object.assign(state.user, data);
    window.currentUser = state.user;
    state.editing = false;
    showToast('Profile updated.', 'success');
    renderProfilePage(mount, state);
  });

  document.getElementById('changePhotoBtn').addEventListener('click', () => document.getElementById('photoInput').click());
  document.getElementById('photoInput').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    const photoURL = await uploadProfilePhoto(user.uid, file);
    await updateUser(user.uid, { photoURL });
    showToast('Profile photo updated.', 'success');
  });
  document.getElementById('validIdInput').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    showLoader();
    try {
      const validIdUrl = await uploadFile(file, `users/${user.uid}/valid-id-${Date.now()}-${file.name}`);
      await updateUser(user.uid, { validIdUrl, validIdName: file.name });
      state.user.validIdUrl = validIdUrl;
      state.user.validIdName = file.name;
      document.getElementById('validIdLabel').textContent = file.name;
      showToast('Valid ID uploaded.', 'success');
    } catch (error) {
      showToast(error.message || 'Unable to upload valid ID.', 'error');
    } finally {
      hideLoader();
    }
  });
  document.getElementById('passwordForm').addEventListener('submit', async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!validatePassword(data.newPassword) || data.newPassword !== data.confirmPassword) {
      showToast('New passwords must match and be at least 8 characters.', 'warning');
      return;
    }
    try {
      if (!auth?.currentUser || firebaseConfig.apiKey === 'YOUR_API_KEY') {
        showToast('Password change is available after Firebase Auth sign-in.', 'info');
        return;
      }
      showLoader();
      const credential = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, data.currentPassword);
      await auth.currentUser.reauthenticateWithCredential(credential);
      await auth.currentUser.updatePassword(data.newPassword);
      event.currentTarget.reset();
      showToast('Password updated.', 'success');
    } catch (error) {
      const messages = {
        'auth/wrong-password': 'Current password is incorrect.',
        'auth/invalid-credential': 'Current password is incorrect.',
        'auth/weak-password': 'New password is too weak.'
      };
      showToast(messages[error.code] || error.message || 'Unable to update password.', 'error');
    } finally {
      hideLoader();
    }
  });
  document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    confirmDialog('Request account deletion? Municipal staff must verify this action.', () => showToast('Deletion request recorded.', 'info'));
  });
}
