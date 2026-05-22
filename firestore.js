/* /assets/js/firestore.js */
const col = name => db.collection(name);
const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();
const localKey = name => `hallpay:${name}`;

function readLocal(name, fallback) {
  try {
    const saved = localStorage.getItem(localKey(name));
    return saved ? JSON.parse(saved) : fallback;
  } catch (error) {
    console.warn(`Local ${name} fallback:`, error);
    return fallback;
  }
}

function writeLocal(name, value) {
  localStorage.setItem(localKey(name), JSON.stringify(value));
  return value;
}

function withLocalCollection(name, fallback) {
  return readLocal(name, fallback.map(item => ({ ...item })));
}

function isFirebaseConfigured() {
  return Boolean(db && firebaseConfig.apiKey !== 'YOUR_API_KEY');
}

async function safeGetDocs(query, fallback = []) {
  if (!isFirebaseConfigured()) return fallback;
  try {
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.warn('Firestore fallback:', error);
    return fallback;
  }
}

async function getUser(uid) {
  if (!isFirebaseConfigured()) {
    const users = withLocalCollection('users', [{ ...demoUser, id: demoUser.uid }]);
    return users.find(user => user.uid === uid || user.id === uid) || { ...demoUser, uid };
  }
  const snapshot = await col('users').doc(uid).get();
  return snapshot.exists ? { id: snapshot.id, uid: snapshot.id, ...snapshot.data() } : null;
}

async function createUser(uid, data) {
  if (!isFirebaseConfigured()) {
    const users = withLocalCollection('users', [{ ...demoUser, id: demoUser.uid }]);
    const existing = users.findIndex(user => user.uid === uid || user.id === uid);
    const payload = { id: uid, uid, ...data };
    if (existing >= 0) users[existing] = { ...users[existing], ...payload };
    else users.push(payload);
    writeLocal('users', users);
    return uid;
  }
  await col('users').doc(uid).set(data, { merge: true });
  return uid;
}

async function updateUser(uid, data) {
  if (!isFirebaseConfigured()) {
    const users = withLocalCollection('users', [{ ...demoUser, id: demoUser.uid }]);
    const existing = users.findIndex(user => user.uid === uid || user.id === uid);
    if (existing >= 0) users[existing] = { ...users[existing], ...data, updatedAt: new Date() };
    else users.push({ id: uid, uid, ...demoUser, ...data, updatedAt: new Date() });
    writeLocal('users', users);
    return;
  }
  return col('users').doc(uid).update({ ...data, updatedAt: serverTime() });
}

function watchUser(uid, callback) {
  if (!isFirebaseConfigured()) {
    callback(demoUser);
    return () => {};
  }
  return col('users').doc(uid).onSnapshot(snapshot => callback({ id: snapshot.id, ...snapshot.data() }));
}

async function getServices() {
  if (!isFirebaseConfigured()) return withLocalCollection('services', demoServices).filter(service => service.active !== false);
  const services = await safeGetDocs(col('services'), demoServices);
  const activeServices = services.filter(service => service.active !== false);
  return activeServices.length ? activeServices : demoServices;
}

async function getService(serviceId) {
  if (!isFirebaseConfigured()) return withLocalCollection('services', demoServices).find(service => service.id === serviceId) || demoServices[0];
  try {
    const snapshot = await col('services').doc(serviceId).get();
    if (snapshot.exists) return { id: snapshot.id, ...snapshot.data() };
  } catch (error) {
    console.warn('Service fallback:', error);
  }
  return demoServices.find(service => service.id === serviceId) || demoServices[0];
}

async function seedDefaultServices() {
  if (!isFirebaseConfigured()) {
    writeLocal('services', demoServices.map(service => ({ ...service, active: true, updatedAt: new Date() })));
    return demoServices.length;
  }
  const batch = db.batch();
  demoServices.forEach(service => {
    batch.set(col('services').doc(service.id), { ...service, active: true, updatedAt: serverTime() }, { merge: true });
  });
  await batch.commit();
  return demoServices.length;
}

async function saveService(serviceId, data) {
  const id = serviceId || String(data.name || 'service')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `service-${Date.now()}`;
  const payload = { ...data, id, updatedAt: isFirebaseConfigured() ? serverTime() : new Date() };

  if (!isFirebaseConfigured()) {
    const services = withLocalCollection('services', demoServices);
    const existing = services.findIndex(service => service.id === id);
    if (existing >= 0) services[existing] = { ...services[existing], ...payload };
    else services.push({ ...payload, createdAt: new Date() });
    writeLocal('services', services);
    return id;
  }

  await col('services').doc(id).set(payload, { merge: true });
  return id;
}

async function updateService(serviceId, data) {
  return saveService(serviceId, data);
}

async function deleteService(serviceId) {
  if (!isFirebaseConfigured()) {
    writeLocal('services', withLocalCollection('services', demoServices).filter(service => service.id !== serviceId));
    return;
  }
  return col('services').doc(serviceId).delete();
}

async function createApplication(data) {
  const referenceNumber = generateReferenceNumber();
  const payload = {
    ...data,
    referenceNumber,
    status: 'submitted',
    createdAt: serverTime(),
    updatedAt: serverTime(),
    statusHistory: [{ status: 'submitted', date: new Date(), note: 'Application submitted' }]
  };

  if (!isFirebaseConfigured()) {
    const id = `app-${Date.now()}`;
    const applications = withLocalCollection('applications', demoApplications);
    applications.unshift({ id, ...payload, createdAt: new Date(), updatedAt: new Date() });
    writeLocal('applications', applications);
    const assessments = withLocalCollection('assessments', []);
    assessments.unshift({
      id: `assessment-${Date.now()}`,
      applicationId: id,
      userId: data.userId,
      serviceName: data.serviceName,
      items: [{ label: 'Base Fee', amount: data.baseFee || 0 }],
      totalAmount: data.baseFee || 0,
      status: 'pending',
      createdAt: new Date()
    });
    writeLocal('assessments', assessments);
    showToast(`Application ${referenceNumber} submitted`, 'success');
    return id;
  }

  const docRef = await col('applications').add(payload);
  await createAssessment({
    applicationId: docRef.id,
    userId: data.userId,
    serviceName: data.serviceName,
    items: [{ label: 'Base Fee', amount: data.baseFee || 0 }],
    totalAmount: data.baseFee || 0,
    status: 'pending'
  });
  await createNotification({
    userId: data.userId,
    title: 'Application submitted',
    body: `Reference ${referenceNumber} was received.`,
    type: 'info',
    deepLinkRoute: `/citizen/application-details.html?id=${docRef.id}`
  });
  await writeAuditLog({ action: 'createApplication', targetId: docRef.id, userId: data.userId });
  return docRef.id;
}

async function getApplication(appId) {
  if (!isFirebaseConfigured()) return withLocalCollection('applications', demoApplications).find(app => app.id === appId) || demoApplications[0];
  const snapshot = await col('applications').doc(appId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function getUserApplications(userId, statusFilter = null) {
  if (!isFirebaseConfigured()) {
    const applications = withLocalCollection('applications', demoApplications);
    return statusFilter ? applications.filter(app => app.status === statusFilter) : applications;
  }
  let query = col('applications').where('userId', '==', userId);
  const applications = await safeGetDocs(query, []);
  const filtered = statusFilter ? applications.filter(app => app.status === statusFilter) : applications;
  return filtered.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
}

function watchUserApplications(userId, callback) {
  if (!isFirebaseConfigured()) {
    callback(demoApplications);
    return () => {};
  }
  return col('applications').where('userId', '==', userId).onSnapshot(snapshot => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
}

async function updateApplicationStatus(appId, newStatus, remarks = null) {
  if (!isFirebaseConfigured()) {
    const applications = withLocalCollection('applications', demoApplications);
    const app = applications.find(item => item.id === appId);
    if (app) {
      const entry = { status: newStatus, date: new Date(), note: remarks || '' };
      app.status = newStatus;
      app.remarks = remarks;
      app.updatedAt = new Date();
      app.statusHistory = [...(app.statusHistory || []), entry];
      writeLocal('applications', applications);
    }
    showToast('Status updated', 'success');
    return;
  }
  const entry = { status: newStatus, date: new Date(), note: remarks || '' };
  await col('applications').doc(appId).update({
    status: newStatus,
    remarks,
    updatedAt: serverTime(),
    statusHistory: firebase.firestore.FieldValue.arrayUnion(entry)
  });
  const application = await getApplication(appId);
  if (application?.userId) {
    await createNotification({
      userId: application.userId,
      title: 'Application updated',
      body: `Your application is now ${statusLabels[newStatus]}.`,
      type: newStatus === 'rejected' ? 'error' : 'info',
      deepLinkRoute: `/citizen/application-details.html?id=${appId}`
    });
  }
  await writeAuditLog({ action: 'updateApplicationStatus', targetId: appId, status: newStatus, remarks });
}

async function updateApplicationDocuments(appId, documents) {
  if (!isFirebaseConfigured()) {
    const applications = withLocalCollection('applications', demoApplications);
    const app = applications.find(item => item.id === appId);
    if (app) {
      app.documents = documents;
      app.updatedAt = new Date();
      writeLocal('applications', applications);
    }
    return;
  }
  return col('applications').doc(appId).update({ documents, updatedAt: serverTime() });
}

async function getAssessmentByApplicationId(appId) {
  if (!isFirebaseConfigured()) {
    const saved = withLocalCollection('assessments', []).find(item => item.applicationId === appId);
    if (saved) return saved;
    const application = await getApplication(appId);
    const service = demoServices.find(item => item.name === application?.serviceName) || demoServices[0];
    return {
      id: 'assessment-demo',
      applicationId: appId,
      items: [{ label: 'Base Fee', amount: service.baseFee }, { label: 'Processing Fee', amount: 50 }],
      totalAmount: service.baseFee + 50,
      status: 'pending'
    };
  }
  const snapshot = await col('assessments').where('applicationId', '==', appId).limit(1).get();
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function createAssessment(data) {
  if (!isFirebaseConfigured()) {
    const id = `assessment-${Date.now()}`;
    const assessments = withLocalCollection('assessments', []);
    assessments.unshift({ id, ...data, createdAt: new Date() });
    writeLocal('assessments', assessments);
    return id;
  }
  return (await col('assessments').add({ ...data, createdAt: serverTime() })).id;
}

async function createPayment(data) {
  const payload = {
    ...data,
    status: data.status || 'pending',
    createdAt: serverTime(),
    referenceNumber: data.referenceNumber || `PAY-${Date.now()}`
  };
  if (!isFirebaseConfigured()) {
    const id = `pay-${Date.now()}`;
    const payments = withLocalCollection('payments', demoPayments);
    payments.unshift({ id, ...payload, createdAt: new Date() });
    writeLocal('payments', payments);
    if (!data.skipApplicationStatusUpdate) await updateApplicationStatus(data.applicationId, 'paymentPending', 'Payment proof submitted.');
    return id;
  }
  const docRef = await col('payments').add(payload);
  if (!data.skipApplicationStatusUpdate) {
    await updateApplicationStatus(data.applicationId, 'paymentPending', 'Payment proof submitted.');
  }
  return docRef.id;
}

async function getPayment(paymentId) {
  if (!isFirebaseConfigured()) {
    return withLocalCollection('payments', demoPayments).find(payment => payment.id === paymentId) || {
      id: paymentId,
      applicationId: 'app-001',
      amount: 850,
      method: 'GCash',
      paymentMethodId: 'gcash',
      paymentChannel: 'E-wallet',
      transactionReference: 'GCASH-DEMO-001',
      payerAccount: '09171234567',
      status: 'confirmed',
      referenceNumber: 'PAY-DEMO',
      createdAt: new Date()
    };
  }
  const snapshot = await col('payments').doc(paymentId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function updatePaymentStatus(paymentId, status, extra = {}) {
  if (!isFirebaseConfigured()) {
    const payments = withLocalCollection('payments', demoPayments);
    const payment = payments.find(item => item.id === paymentId);
    if (payment) {
      Object.assign(payment, extra, { status, updatedAt: new Date(), confirmedAt: status === 'confirmed' ? new Date() : null });
      writeLocal('payments', payments);
      if (status === 'confirmed') {
        await createReceipt({
          paymentId,
          applicationId: payment.applicationId,
          userId: payment.userId,
          amount: payment.amount,
          method: payment.method,
          serviceName: payment.serviceName || 'Municipal Service',
          referenceNumber: payment.referenceNumber,
          citizenName: payment.citizenName || payment.payerName || null,
          status: 'confirmed',
          receiptNumber: generateReceiptNumber(),
          qrData: `HALLPAY|RECEIPT|receipt-${Date.now()}|${generateReceiptNumber()}|confirmed|${payment.applicationId}`
        });
        await updateApplicationStatus(payment.applicationId, 'paid', 'Payment confirmed by Treasurer.');
      }
    }
    showToast('Payment confirmed', 'success');
    return;
  }
  await col('payments').doc(paymentId).update({
    ...extra,
    status,
    updatedAt: serverTime(),
    confirmedAt: status === 'confirmed' ? serverTime() : null
  });
  if (status === 'confirmed') {
    const payment = await getPayment(paymentId);
    const receiptId = payment.receiptId || col('receipts').doc().id;
    const receiptNumber = generateReceiptNumber();
    await createReceipt({
      id: receiptId,
      paymentId,
      applicationId: payment.applicationId,
      userId: payment.userId,
      amount: payment.amount,
      method: payment.method,
      serviceName: payment.serviceName || 'Municipal Service',
      referenceNumber: payment.referenceNumber,
      citizenName: payment.citizenName || payment.payerName || null,
      status: 'confirmed',
      receiptNumber,
      qrData: `HALLPAY|RECEIPT|${receiptId}|${receiptNumber}|confirmed|${payment.applicationId}`
    });
    await updateApplicationStatus(payment.applicationId, 'paid', 'Payment confirmed by Treasurer.');
  }
}

async function updatePaymentProof(paymentId, proofUrl, proofFileName = null) {
  if (!isFirebaseConfigured()) {
    const payments = withLocalCollection('payments', demoPayments);
    const payment = payments.find(item => item.id === paymentId);
    if (payment) {
      payment.proofUrl = proofUrl;
      payment.proofFileName = proofFileName;
      payment.updatedAt = new Date();
      writeLocal('payments', payments);
    }
    return;
  }
  return col('payments').doc(paymentId).update({
    proofUrl,
    proofFileName,
    updatedAt: serverTime()
  });
}

async function createReceipt(data) {
  if (!isFirebaseConfigured()) {
    const id = data.id || `receipt-${Date.now()}`;
    const receipts = withLocalCollection('receipts', []);
    receipts.unshift({ id, ...data, createdAt: new Date() });
    writeLocal('receipts', receipts);
    return id;
  }
  const { id, ...payload } = data;
  if (id) {
    await col('receipts').doc(id).set({ ...payload, createdAt: serverTime() }, { merge: true });
    return id;
  }
  return (await col('receipts').add({ ...payload, createdAt: serverTime() })).id;
}

async function getReceipt(receiptId) {
  if (!isFirebaseConfigured()) {
    const saved = withLocalCollection('receipts', []).find(receipt => receipt.id === receiptId);
    if (saved) return saved;
    return {
      id: receiptId,
      receiptNumber: 'RCP-20260510001',
      citizenName: 'Juan Dela Cruz',
      amount: 120,
      serviceName: 'Community Tax Certificate',
      referenceNumber: 'HALLPAY-2026-02780',
      method: 'GCash',
      createdAt: new Date(),
      qrData: 'HALLPAY|RECEIPT|receipt-demo|RCP-20260510001|confirmed|app-002'
    };
  }
  const snapshot = await col('receipts').doc(receiptId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function getReceiptByApplicationId(appId) {
  if (!isFirebaseConfigured()) return withLocalCollection('receipts', []).find(receipt => receipt.applicationId === appId) || getReceipt('receipt-demo');
  const snapshot = await col('receipts').where('applicationId', '==', appId).limit(1).get();
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function createPermit(data) {
  if (!isFirebaseConfigured()) {
    const id = `permit-${Date.now()}`;
    const permits = withLocalCollection('permits', []);
    permits.unshift({ id, ...data, createdAt: new Date() });
    writeLocal('permits', permits);
    return id;
  }
  return (await col('permits').add({ ...data, createdAt: serverTime() })).id;
}

async function getPermit(permitId) {
  if (!isFirebaseConfigured()) {
    const saved = withLocalCollection('permits', []).find(permit => permit.id === permitId);
    if (saved) return saved;
    return {
      id: permitId,
      permitNumber: 'BUS-2026-0123',
      permitType: 'Business Permit',
      citizenName: 'Juan Dela Cruz',
      address: 'Kabacan, North Cotabato',
      issueDate: new Date(),
      expiryDate: new Date('2027-05-21'),
      mayorName: 'Municipal Mayor',
      qrData: 'HALLPAY|PERMIT|permit-demo|BUS-2026-0123|valid|2027-05-21'
    };
  }
  const snapshot = await col('permits').doc(permitId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function getPermitByApplicationId(appId) {
  if (!isFirebaseConfigured()) return withLocalCollection('permits', []).find(permit => permit.applicationId === appId) || getPermit('permit-demo');
  const snapshot = await col('permits').where('applicationId', '==', appId).limit(1).get();
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

async function verifyQRData(qrString) {
  const rawCode = String(qrString || '').trim();
  let code = rawCode;
  try {
    const parsedUrl = new URL(rawCode);
    code = parsedUrl.searchParams.get('code') || parsedUrl.searchParams.get('data') || rawCode;
  } catch (_) {}

  const parts = String(code || '').split('|').map(part => part.trim());
  const [issuer, type, documentId, documentNumber, qrStatus, extra] = parts;
  if (!code) return { valid: false, status: 'INVALID', message: 'Enter or scan a HALL-PAY QR code.' };
  if (issuer !== 'HALLPAY') return { valid: false, status: 'INVALID', message: 'Code is not issued by HALL-PAY.' };
  if (!['RECEIPT', 'PERMIT'].includes(type) || !documentId || !documentNumber) {
    return { valid: false, status: 'INVALID', message: 'QR code is incomplete or malformed.' };
  }

  const normalizedStatus = String(qrStatus || '').toLowerCase();
  const payloadStatus = normalizedStatus === 'revoked' ? 'REVOKED' : normalizedStatus === 'expired' ? 'EXPIRED' : 'VALID';
  const payloadResult = {
    valid: payloadStatus === 'VALID',
    status: payloadStatus,
    type,
    number: documentNumber,
    issuedTo: null,
    issueDate: null,
    validUntil: type === 'PERMIT' && extra ? extra : null,
    message: isFirebaseConfigured() ? 'QR payload is readable, but the official record could not be checked.' : '',
    data: { id: documentId, qrData: code }
  };

  if (!isFirebaseConfigured()) {
    const knownDemoCodes = new Set([
      'HALLPAY|RECEIPT|receipt-demo|RCP-20260510001|confirmed|app-002',
      'HALLPAY|RECEIPT|rcp-demo|RCP-20260510001|confirmed|app-002',
      'HALLPAY|PERMIT|permit-demo|BUS-2026-0123|valid|2027-05-21'
    ]);
    if (!knownDemoCodes.has(parts.join('|'))) {
      return payloadResult;
    }
  }

  let data = null;
  try {
    data = type === 'RECEIPT' ? await getReceipt(documentId) : await getPermit(documentId);
  } catch (error) {
    console.warn('QR verification record lookup failed:', error);
    return payloadResult;
  }
  if (!data) return { valid: false, status: 'NOT FOUND', type, number: documentNumber, message: 'No matching HALL-PAY record was found.' };

  const storedNumber = type === 'RECEIPT' ? data.receiptNumber : data.permitNumber;
  if (storedNumber && storedNumber !== documentNumber && data.referenceNumber !== documentNumber) {
    return { valid: false, status: 'MISMATCH', type, number: documentNumber, message: 'QR details do not match the official record.' };
  }

  const recordStatus = String(data.status || qrStatus || '').toLowerCase();
  const status = recordStatus === 'revoked' ? 'REVOKED' : recordStatus === 'expired' ? 'EXPIRED' : 'VALID';
  return {
    valid: status === 'VALID',
    status,
    type,
    number: storedNumber || documentNumber,
    issuedTo: data?.citizenName || 'Juan Dela Cruz',
    issueDate: data?.createdAt || data?.issueDate,
    validUntil: data?.expiryDate,
    data
  };
}

async function createNotification(data) {
  if (!isFirebaseConfigured()) {
    const id = `notification-${Date.now()}`;
    const notifications = withLocalCollection('notifications', []);
    notifications.unshift({ id, ...data, read: false, createdAt: new Date() });
    writeLocal('notifications', notifications);
    return id;
  }
  return (await col('notifications').add({ ...data, read: false, createdAt: serverTime() })).id;
}

async function getUserNotifications(userId) {
  if (!isFirebaseConfigured()) {
    return [
      { id: 'n1', title: 'Assessment ready', body: 'Your Business Permit assessment is ready for payment.', type: 'warning', read: false, createdAt: new Date(), deepLinkRoute: '/citizen/application-details.html?id=app-001' },
      { id: 'n2', title: 'Receipt issued', body: 'Your receipt is available for download.', type: 'success', read: true, createdAt: new Date('2026-05-10') }
    ];
  }
  const notifications = await safeGetDocs(col('notifications').where('userId', '==', userId), []);
  return notifications.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
}

function watchNotifications(userId, callback) {
  if (!isFirebaseConfigured()) {
    getUserNotifications(userId).then(callback);
    return () => {};
  }
  return col('notifications').where('userId', '==', userId).onSnapshot(snapshot => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
}

async function markNotificationRead(notificationId) {
  if (!isFirebaseConfigured()) return;
  return col('notifications').doc(notificationId).update({ read: true });
}

async function markAllRead(userId) {
  if (!isFirebaseConfigured()) return;
  const snapshot = await col('notifications').where('userId', '==', userId).where('read', '==', false).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true }));
  return batch.commit();
}

async function getAnnouncements(category = null) {
  if (!isFirebaseConfigured()) {
    const announcements = withLocalCollection('announcements', demoAnnouncements);
    return category ? announcements.filter(item => item.category.toLowerCase() === category.toLowerCase()) : announcements;
  }
  const announcements = await safeGetDocs(col('announcements'), demoAnnouncements);
  return announcements
    .filter(item => !item.status || item.status === 'published')
    .filter(item => !item.expiresAt || toDate(item.expiresAt) >= new Date())
    .filter(item => !category || item.category === category)
    .sort((a, b) => toDate(b.publishedAt) - toDate(a.publishedAt));
}

async function getAllAnnouncements(filters = {}) {
  const category = filters.category && filters.category !== 'All' ? filters.category : null;
  const status = filters.status && filters.status !== 'All' ? filters.status : null;

  if (!isFirebaseConfigured()) {
    return withLocalCollection('announcements', demoAnnouncements)
      .map(item => ({ status: 'published', expiresAt: null, ...item }))
      .filter(item => !category || item.category === category)
      .filter(item => !status || item.status === status)
      .sort((a, b) => toDate(b.updatedAt || b.publishedAt || b.createdAt) - toDate(a.updatedAt || a.publishedAt || a.createdAt));
  }

  const announcements = await safeGetDocs(col('announcements'), demoAnnouncements);
  return announcements
    .filter(item => !category || item.category === category)
    .filter(item => !status || item.status === status)
    .sort((a, b) => toDate(b.updatedAt || b.publishedAt || b.createdAt) - toDate(a.updatedAt || a.publishedAt || a.createdAt));
}

async function createAnnouncement(data) {
  const payload = {
    title: data.title,
    category: data.category || 'Advisory',
    content: data.content,
    status: data.status || 'published',
    pinned: Boolean(data.pinned),
    expiresAt: data.expiresAt || null,
    publishedAt: data.status === 'draft' ? null : (data.publishedAt || serverTime()),
    createdAt: serverTime(),
    updatedAt: serverTime(),
    createdBy: data.createdBy || auth.currentUser?.uid || null
  };

  if (!isFirebaseConfigured()) {
    const id = data.id || `ann-${Date.now()}`;
    const announcements = withLocalCollection('announcements', demoAnnouncements);
    announcements.unshift({ id, ...payload, publishedAt: data.status === 'draft' ? null : new Date(), createdAt: new Date(), updatedAt: new Date() });
    writeLocal('announcements', announcements);
    return id;
  }
  return (await col('announcements').add(payload)).id;
}

async function updateAnnouncement(announcementId, data) {
  const payload = {
    ...data,
    pinned: Boolean(data.pinned),
    expiresAt: data.expiresAt || null,
    updatedAt: serverTime()
  };

  if (payload.status && payload.status !== 'draft' && !payload.publishedAt) {
    payload.publishedAt = serverTime();
  }

  if (!isFirebaseConfigured()) {
    const announcements = withLocalCollection('announcements', demoAnnouncements);
    const announcement = announcements.find(item => item.id === announcementId);
    if (announcement) Object.assign(announcement, data, { updatedAt: new Date() });
    writeLocal('announcements', announcements);
    return;
  }
  return col('announcements').doc(announcementId).update(payload);
}

async function deleteAnnouncement(announcementId) {
  if (!isFirebaseConfigured()) {
    writeLocal('announcements', withLocalCollection('announcements', demoAnnouncements).filter(item => item.id !== announcementId));
    return;
  }
  return col('announcements').doc(announcementId).delete();
}

async function createSupportTicket(data) {
  if (!isFirebaseConfigured()) {
    const id = `TCK-${Date.now()}`;
    const tickets = withLocalCollection('supportTickets', []);
    tickets.unshift({ id, ...data, status: 'open', createdAt: new Date(), updatedAt: new Date() });
    writeLocal('supportTickets', tickets);
    showToast('Ticket submitted', 'success');
    return id;
  }
  return (await col('supportTickets').add({ ...data, status: 'open', createdAt: serverTime(), updatedAt: serverTime() })).id;
}

async function getUserTickets(userId) {
  if (!isFirebaseConfigured()) {
    const tickets = withLocalCollection('supportTickets', [{ id: 'TCK-001', userId, subject: 'Payment confirmation', status: 'open', createdAt: new Date(), updatedAt: new Date(), message: 'Please confirm my payment.' }]);
    return tickets.filter(ticket => !ticket.userId || ticket.userId === userId);
  }
  const tickets = await safeGetDocs(col('supportTickets').where('userId', '==', userId), []);
  return tickets.sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt));
}

async function writeAuditLog(data) {
  if (!isFirebaseConfigured()) return;
  return col('auditLogs').add({ ...data, createdAt: serverTime() });
}

async function getAppSettings() {
  if (!isFirebaseConfigured()) {
    const saved = localStorage.getItem('hallpay:adminSettings');
    return saved ? { ...defaultAppSettings(), ...JSON.parse(saved) } : defaultAppSettings();
  }
  const snapshot = await col('settings').doc('app').get();
  return snapshot.exists ? { ...defaultAppSettings(), ...snapshot.data() } : defaultAppSettings();
}

function defaultAppSettings() {
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
    termsUrl: '/terms-of-service.html',
    updatedAt: null
  };
}

async function updateAppSettings(data) {
  const payload = { ...data, updatedAt: serverTime(), updatedBy: auth.currentUser?.uid || null };
  if (!isFirebaseConfigured()) {
    localStorage.setItem('hallpay:adminSettings', JSON.stringify({ ...data, updatedAt: new Date().toISOString() }));
    return;
  }
  return col('settings').doc('app').set(payload, { merge: true });
}

async function getAllUsers(roleFilter = null) {
  const fallback = [
    { ...demoUser, id: 'demo-user' },
    { id: 'staff-1', fullName: 'Maria Santos', email: 'staff@kabacan.gov.ph', role: 'staff', status: 'active', createdAt: new Date() }
  ];
  if (!isFirebaseConfigured()) return withLocalCollection('users', fallback).filter(user => !roleFilter || user.role === roleFilter);
  const users = await safeGetDocs(col('users'), fallback);
  return users.filter(user => !roleFilter || user.role === roleFilter);
}

async function getAllApplications(filters = {}) {
  if (!isFirebaseConfigured()) return withLocalCollection('applications', demoApplications).filter(app => !filters.status || app.status === filters.status);
  const applications = await safeGetDocs(col('applications'), demoApplications);
  return applications.filter(app => !filters.status || app.status === filters.status);
}

async function getAllPayments(filters = {}) {
  if (!isFirebaseConfigured()) return withLocalCollection('payments', demoPayments)
    .filter(payment => !filters.status || payment.status === filters.status)
    .filter(payment => !filters.userId || payment.userId === filters.userId);
  const payments = await safeGetDocs(col('payments'), demoPayments);
  return payments
    .filter(payment => !filters.status || payment.status === filters.status)
    .filter(payment => !filters.userId || payment.userId === filters.userId);
}
