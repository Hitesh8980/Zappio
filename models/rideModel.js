const admin = require('firebase-admin');
const db = admin.firestore();

const create = async (data) => {
  const rideRef = db.collection('rides').doc();
  await rideRef.set(data);
  return { id: rideRef.id, ...data };
};

const get = async (rideId) => {
  const rideRef = db.collection('rides').doc(rideId);
  const doc = await rideRef.get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

const update = async (rideId, data) => {
  const rideRef = db.collection('rides').doc(rideId);
  await rideRef.update(data);
  return { id: rideId, ...data };
};

module.exports = { create, get, update };