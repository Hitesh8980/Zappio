const admin = require('firebase-admin');
const db = admin.firestore();

const create = async (data) => {
  const bookingRef = db.collection('bookings').doc();
  await bookingRef.set(data);
  return { id: bookingRef.id, ...data };
};

const get = async (bookingId) => {
  const bookingRef = db.collection('bookings').doc(bookingId);
  const doc = await bookingRef.get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

module.exports = { create, get };