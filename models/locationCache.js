const admin = require('firebase-admin');
const db = admin.firestore();

const cacheLocation = async (address, coordinates) => {
  const cacheRef = db.collection('locationCache').doc(address.replace(/\s+/g, '_'));
  await cacheRef.set({
    address,
    coordinates,
    cachedAt: new Date().toISOString()
  });
};

const getCachedLocation = async (address) => {
  const cacheRef = db.collection('locationCache').doc(address.replace(/\s+/g, '_'));
  const doc = await cacheRef.get();
  if (!doc.exists) return null;
  return doc.data();
};

module.exports = { cacheLocation, getCachedLocation };