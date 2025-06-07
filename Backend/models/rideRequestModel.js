const admin = require('firebase-admin');
const { db } = require('../config/firebase');

const RIDE_REQUEST_COLLECTION = 'rideRequests';

const createRideRequest = async (rideId, searchRadius = 5) => {
  try {
    const request = {
      rideId,
      searchRadius,
      status: 'pending',
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 1000)),
    };

    const requestRef = db.collection(RIDE_REQUEST_COLLECTION).doc();
    await requestRef.set(request);
    return { id: requestRef.id, ...request };
  } catch (error) {
    throw new Error(`Failed to create ride request: ${error.message}`);
  }
};

const getRideRequest = async (requestId) => {
  try {
    const requestRef = db.collection(RIDE_REQUEST_COLLECTION).doc(requestId);
    const doc = await requestRef.get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    throw new Error(`Failed to get ride request: ${error.message}`);
  }
};

const updateRideRequest = async (requestId, updates) => {
  try {
    const requestRef = db.collection(RIDE_REQUEST_COLLECTION).doc(requestId);
    await requestRef.update(updates);
    const updated = await requestRef.get();
    if (!updated.exists) throw new Error('Ride request not found');
    return { id: requestId, ...updated.data() };
  } catch (error) {
    throw new Error(`Failed to update ride request: ${error.message}`);
  }
};

module.exports = { createRideRequest, getRideRequest, updateRideRequest };