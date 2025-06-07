const admin = require('firebase-admin');
const { db } = require('../config/firebase');

const create = async (data) => {
  try {
    const ride = {
      userId: data.userId,
      driverId: data.driverId || null,
      pickupLocation: data.pickupLocation, // GeoPoint
      dropLocation: data.dropLocation, // GeoPoint
      vehicleType: data.vehicleType,
      distance: data.distance || { value: 0, text: '' },
      duration: data.duration || { value: 0, text: '' },
      fare: data.fare || 0,
      route: data.route || '',
      status: data.status || 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      etaCompletion: null,
      riderRating: data.riderRating || 4.0,
    };

    const rideRef = db.collection('rides').doc();
    await rideRef.set(ride);
    return { id: rideRef.id, ...ride };
  } catch (error) {
    throw new Error(`Failed to create ride: ${error.message}`);
  }
};

const get = async (rideId) => {
  try {
    const rideRef = db.collection('rides').doc(rideId);
    const doc = await rideRef.get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    throw new Error(`Failed to get ride: ${error.message}`);
  }
};

const update = async (rideId, data) => {
  try {
    const rideRef = db.collection('rides').doc(rideId);
    const updates = {
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await rideRef.update(updates);
    const updated = await rideRef.get();
    if (!updated.exists) throw new Error('Ride not found');
    return { id: rideId, ...updated.data() };
  } catch (error) {
    throw new Error(`Failed to update ride: ${error.message}`);
  }
};

module.exports = { create, get, update };