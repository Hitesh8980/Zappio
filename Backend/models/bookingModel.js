const admin = require('firebase-admin');

const { db } = require('../config/firebase'); 

const create = async (data) => {
  const bookingRef = db.collection('bookings').doc();
  await bookingRef.set(data);
  return { id: bookingRef.id, ...data };
};

const get = async (bookingId) => {
  const bookingDoc = await db.collection('bookings').doc(bookingId).get();
  if (!bookingDoc.exists) return null;
  return { id: bookingDoc.id, ...bookingDoc.data() };
};

module.exports = { create, get };