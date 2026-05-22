/* /assets/js/pages/forgot-password.js */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resetForm');
  if (!form) return;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      if (firebaseConfig.apiKey !== 'YOUR_API_KEY') {
        await sendPasswordReset(form.email.value);
      }
      showToast('Password reset email sent.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
});
