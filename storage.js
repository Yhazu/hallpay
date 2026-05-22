/* /assets/js/storage.js */
const cloudinaryConfig = {
  cloudName: 'depbx8tkc',
  apiKey: '949639774513552',
  unsignedPreset: 'vo0z68ka'
};

async function uploadFile(file, path, onProgress) {
  if (!file) throw new Error('No file selected.');

  if (cloudinaryConfig.cloudName && cloudinaryConfig.unsignedPreset) {
    return uploadToCloudinary(file, path, onProgress);
  }

  if (!storage || firebaseConfig.apiKey === 'YOUR_API_KEY') {
    onProgress && onProgress(100);
    return URL.createObjectURL(file);
  }

  const ref = storage.ref(path);
  const task = ref.put(file);
  return new Promise((resolve, reject) => task.on(
    'state_changed',
    snapshot => onProgress && onProgress(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)),
    reject,
    async () => resolve(await ref.getDownloadURL())
  ));
}

function cloudinaryPublicId(path, fileName) {
  return String(path || fileName || `hallpay-${Date.now()}`)
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '-')
    .replace(/-+/g, '-');
}

async function uploadToCloudinary(file, path, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.unsignedPreset);
  formData.append('api_key', cloudinaryConfig.apiKey);
  formData.append('folder', 'hallpay');
  formData.append('public_id', cloudinaryPublicId(path, file.name));

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`);

    request.upload.onprogress = event => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round(event.loaded / event.total * 100));
      }
    };

    request.onload = () => {
      let response = {};
      try {
        response = JSON.parse(request.responseText || '{}');
      } catch (error) {
        reject(new Error('Cloudinary returned an invalid response.'));
        return;
      }

      if (request.status >= 200 && request.status < 300 && response.secure_url) {
        onProgress && onProgress(100);
        resolve(response.secure_url);
        return;
      }

      reject(new Error(response.error?.message || 'Cloudinary upload failed.'));
    };

    request.onerror = () => reject(new Error('Cloudinary upload failed. Check your connection and upload preset.'));
    request.send(formData);
  });
}

async function uploadApplicationDocument(appId, file, name, onProgress) {
  return uploadFile(file, `applications/${appId}/${Date.now()}-${name || file.name}`, onProgress);
}

async function uploadProfilePhoto(uid, file, onProgress) {
  return uploadFile(file, `users/${uid}/profile-${Date.now()}-${file.name}`, onProgress);
}

async function uploadPaymentProof(payId, file, onProgress) {
  return uploadFile(file, `payments/${payId}/${Date.now()}-${file.name}`, onProgress);
}
