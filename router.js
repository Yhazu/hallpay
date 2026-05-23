/* /assets/js/router.js */
function getDashboardPath(role) {
  return {
    citizen: '/citizen-dashboard.html',
    staff: '/staff-dashboard.html',
    treasurer: '/treasurer-dashboard.html',
    admin: '/admin-dashboard.html'
  }[role] || '/login.html';
}

async function routeIndex() {
  if (!window.auth || firebaseConfig.apiKey === 'YOUR_API_KEY') {
    navigateTo('/login.html', true);
    return;
  }

  auth.onAuthStateChanged(async user => {
    if (!user) {
      navigateTo('/login.html', true);
      return;
    }

    const profile = await getUser(user.uid);
    navigateTo(getDashboardPath(profile?.role || 'citizen'), true);
  });
}
