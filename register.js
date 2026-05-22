/* /assets/js/pages/register.js */
const form = document.getElementById('registerForm');
const steps = [...document.querySelectorAll('.reg-step')];
const next = document.getElementById('nextBtn');
const prev = document.getElementById('prevBtn');
const submit = document.getElementById('submitBtn');
let step = 0;

form.noValidate = true;
const termsLabel = form.terms?.closest('label');
if (termsLabel) {
  termsLabel.innerHTML = '<input type="checkbox" name="terms" required> I agree to the <a href="/terms-of-service.html" target="_blank" rel="noopener">Terms of Service</a> and <a href="/privacy-policy.html" target="_blank" rel="noopener">Privacy Policy</a>';
}

function validateStep() {
  const controls = [...steps[step].querySelectorAll('input, textarea, select')];
  for (const control of controls) {
    control.classList.remove('error');

    if (control.hasAttribute('required') && !control.value.trim()) {
      control.classList.add('error');
      control.focus();
      showToast('Please complete the required fields before continuing.', 'warning');
      return false;
    }

    if (control.type === 'email' && control.value && !validateEmail(control.value)) {
      control.classList.add('error');
      control.focus();
      showToast('Please enter a valid email address.', 'warning');
      return false;
    }
  }

  if (step === 1) {
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (!validatePassword(password)) {
      form.password.classList.add('error');
      form.password.focus();
      showToast('Password must be at least 8 characters.', 'warning');
      return false;
    }

    if (password !== confirmPassword) {
      form.confirmPassword.classList.add('error');
      form.confirmPassword.focus();
      showToast('Passwords do not match.', 'warning');
      return false;
    }

    if (!form.terms.checked) {
      form.terms.focus();
      showToast('Please accept the terms before continuing.', 'warning');
      return false;
    }
  }

  return true;
}

function sync() {
  steps.forEach((section, index) => {
    section.hidden = index !== step;
  });

  document.querySelectorAll('.step').forEach((item, index) => {
    item.className = `step ${index < step ? 'done' : index === step ? 'active' : 'pending'}`;
  });

  prev.disabled = step === 0;
  next.hidden = step === steps.length - 1;
  submit.hidden = step !== steps.length - 1;

  if (step === steps.length - 1) {
    const data = new FormData(form);
    document.getElementById('reviewBox').innerHTML = ['fullName', 'email', 'phone', 'birthdate', 'address']
      .map(key => `<p><strong>${key}:</strong> ${escapeHtml(data.get(key))}</p>`)
      .join('');
  }
}

function showExistingAccountActions(email) {
  const reviewBox = document.getElementById('reviewBox');
  reviewBox.querySelector('[data-existing-account-actions]')?.remove();
  const panel = document.createElement('div');
  panel.className = 'alert alert-warning';
  panel.dataset.existingAccountActions = 'true';
  panel.innerHTML = `
    <div>
      <strong>This email is already registered.</strong>
      <p class="account-action-copy">Use the existing account for ${escapeHtml(email)}, reset its password, or go back and enter a different email.</p>
      <div class="action-row">
        <a class="btn btn-primary btn-sm" href="/login.html">Sign In</a>
        <a class="btn btn-secondary btn-sm" href="/forgot-password.html">Reset Password</a>
        <button class="btn btn-secondary btn-sm" type="button" id="changeEmailBtn">Change Email</button>
      </div>
    </div>
  `;

  reviewBox.prepend(panel);
  document.getElementById('changeEmailBtn').addEventListener('click', () => {
    step = 0;
    sync();
    form.email.focus();
  });
}

next.addEventListener('click', () => {
  if (!validateStep()) return;
  if (step < steps.length - 1) {
    step += 1;
    sync();
  }
});

prev.addEventListener('click', () => {
  if (step > 0) {
    step -= 1;
    sync();
  }
});

form.password.addEventListener('input', event => {
  const strengthBar = document.getElementById('strengthBar');
  strengthBar.style.width = `${Math.min(event.target.value.length * 12, 100)}%`;
  strengthBar.style.background = event.target.value.length >= 8 ? 'var(--color-success)' : 'var(--color-danger)';
});

form.addEventListener('submit', async event => {
  event.preventDefault();

  if (step !== steps.length - 1) return;

  if (!validateStep()) return;

  const rawData = Object.fromEntries(new FormData(form));
  const validIdFile = form.validId.files[0] || null;
  const data = {
    fullName: rawData.fullName,
    email: rawData.email,
    phone: rawData.phone,
    birthdate: rawData.birthdate,
    address: rawData.address,
    password: rawData.password,
    confirmPassword: rawData.confirmPassword
  };
  if (data.password !== data.confirmPassword) {
    showToast('Passwords do not match.', 'error');
    return;
  }

  try {
    showLoader();
    const user = await register(data, data.password);
    if (validIdFile) {
      const validIdUrl = await uploadFile(validIdFile, `users/${user.uid}/valid-id-${Date.now()}-${validIdFile.name}`);
      await updateUser(user.uid, { validIdUrl, validIdName: validIdFile.name });
    }
    showToast('Registration complete. Please check your email for verification.', 'success');
    location.href = '/login.html';
  } catch (error) {
    if (error.message.includes('already registered') || error.message.includes('already in use')) {
      showExistingAccountActions(data.email);
    }
    showToast(error.message, 'error');
  } finally {
    hideLoader();
  }
});

sync();
