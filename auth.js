/* /assets/js/auth.js */
async function login(email, password) {
  try {
    return (await auth.signInWithEmailAndPassword(email.trim(), password)).user;
  } catch (error) {
    const messages = {
      'auth/invalid-email': 'Invalid email address.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/user-not-found': 'No account found for this email.'
    };
    throw new Error(messages[error.code] || error.message);
  }
}

async function ensureUserProfile(user) {
  let profile = await getUser(user.uid);
  if (profile) return profile;

  profile = {
    uid: user.uid,
    fullName: user.displayName || user.email.split('@')[0],
    email: user.email,
    phone: '',
    address: '',
    role: 'citizen',
    isVerified: user.emailVerified,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await createUser(user.uid, profile);
  return { ...profile, createdAt: new Date() };
}

async function register(userData, password) {
  try {
    const { password: _password, confirmPassword: _confirmPassword, terms: _terms, validId: _validId, ...profileData } = userData;
    const credential = await auth.createUserWithEmailAndPassword(userData.email.trim(), password);
    await credential.user.updateProfile({ displayName: profileData.fullName });
    await createUser(credential.user.uid, {
      ...profileData,
      email: profileData.email.trim(),
      role: 'citizen',
      isVerified: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await credential.user.sendEmailVerification();
    return credential.user;
  } catch (error) {
    const messages = {
      'auth/email-already-in-use': 'This email is already registered. Sign in, reset your password, or use a different email address.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/weak-password': 'Password must be at least 6 characters.'
    };
    throw new Error(messages[error.code] || error.message);
  }
}

async function logout() {
  if (auth) await auth.signOut();
  sessionStorage.clear();
  navigateTo('/login.html');
}

async function sendPasswordReset(email) {
  return auth.sendPasswordResetEmail(email.trim());
}

function redirectToDashboard(role) {
  navigateTo({
    citizen: '/citizen-dashboard.html',
    staff: '/staff-dashboard.html',
    treasurer: '/treasurer-dashboard.html',
    admin: '/admin-dashboard.html'
  }[role] || '/citizen-dashboard.html');
}

function requireAuth(roles = []) {
  return new Promise(resolve => {
    if (!auth || firebaseConfig.apiKey === 'YOUR_API_KEY') {
      window.currentUser = { ...demoUser, role: roles[0] || 'citizen' };
      resolve(window.currentUser);
      return;
    }

    auth.onAuthStateChanged(async user => {
      if (!user) {
        navigateTo('/login.html');
        return;
      }

      const profile = await ensureUserProfile(user);
      window.currentUser = profile;

      if (roles.length && !roles.includes(profile.role)) {
        redirectToDashboard(profile.role);
        return;
      }

      resolve(profile);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (form) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const errorBox = document.getElementById('loginError');

      try {
        showLoader();
        if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
          navigateTo('/citizen-dashboard.html');
          return;
        }

        const user = await login(form.email.value, form.password.value);
        const profile = await ensureUserProfile(user);
        redirectToDashboard(profile.role);
      } catch (error) {
        if (errorBox) {
          errorBox.hidden = false;
          errorBox.textContent = error.message;
        }
      } finally {
        hideLoader();
      }
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  document.querySelectorAll('.password-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const input = button.parentElement.querySelector('input');
      input.type = input.type === 'password' ? 'text' : 'password';
      button.textContent = input.type === 'password' ? 'visibility' : 'visibility_off';
    });
  });
});
