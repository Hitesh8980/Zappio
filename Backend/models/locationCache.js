const admin = require('firebase-admin');
const db = admin.firestore();

const cacheLocation = async (cacheKey, data, ttlMs) => {
  const cacheRef = db.collection('locationCache').doc(cacheKey);
  await cacheRef.set({
    ...data,
    cachedAt: admin.firestore.FieldValue.serverTimestamp(),
    ttl: admin.firestore.Timestamp.fromDate(new Date(Date.now() + ttlMs)),
  });
};

const getCachedLocation = async (cacheKey) => {
  const cacheRef = db.collection('locationCache').doc(cacheKey);
  const doc = await cacheRef.get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.ttl.toMillis() < Date.now()) {
    await cacheRef.delete(); // Clean expired cache
    return null;
  }
  return data;
};

module.exports = { cacheLocation, getCachedLocation };