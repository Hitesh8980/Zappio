const admin = require('firebase-admin');
const { db } = require('../config/firebase');

const USER_COLLECTION = 'users';

const createUser = async (userData) => {
  try {
    const user = {
      name: userData.name,
      mobileNumber: userData.mobileNumber,
      role: 'rider',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      verified: false,
      rating: userData.rating || 4.0,
      fcmToken: userData.fcmToken || null,
      rideHistory: [],
    };

    const userRef = db.collection(USER_COLLECTION).doc(userData.uid);
    await userRef.set(user);
    return { id: userRef.id, ...user };
  } catch (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }
};

const findUserByUID = async (uid) => {
  try {
    const userDoc = await db.collection(USER_COLLECTION).doc(uid).get();
    if (!userDoc.exists) return null;
    return { id: userDoc.id, ...userDoc.data() };
  } catch (error) {
    throw new Error(`Failed to find user by UID: ${error.message}`);
  }
};

const updateUserVerification = async (uid, verified) => {
  try {
    const userRef = db.collection(USER_COLLECTION).doc(uid);
    await userRef.update({ verified });
    const updatedDoc = await userRef.get();
    if (!updatedDoc.exists) throw new Error('User not found');
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    throw new Error(`Failed to update verification: ${error.message}`);
  }
};

const updateUserProfile = async (uid, updates) => {
  try {
    const userRef = db.collection(USER_COLLECTION).doc(uid);
    const allowedUpdates = ['name', 'mobileNumber', 'fcmToken', 'rating'];
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => ({ ...obj, [key]: updates[key] }), {});

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }

    await userRef.update(filteredUpdates);
    const updated = await userRef.get();
    if (!updated.exists) throw new Error('User not found');
    return { id: updated.id, ...updated.data() };
  } catch (error) {
    throw new Error(`Failed to update user profile: ${error.message}`);
  }
};

const getUserRideHistory = async (uid, status = null) => {
  try {
    const userRef = db.collection(USER_COLLECTION).doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) throw new Error('User not found');

    const rideHistory = userDoc.data().rideHistory || [];
    if (!rideHistory.length) return [];

    let query = db.collection('rides').where(admin.firestore.FieldPath.documentId(), 'in', rideHistory);
    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const rides = [];
    snapshot.forEach(doc => {
      const rideData = doc.data();
      rides.push({
        id: doc.id,
        pickupLocation: {
          lat: rideData.pickupLocation._latitude,
          lng: rideData.pickupLocation._longitude,
        },
        dropLocation: {
          lat: rideData.dropLocation._latitude,
          lng: rideData.dropLocation._longitude,
        },
        vehicleType: rideData.vehicleType,
        distance: rideData.distance.text,
        duration: rideData.duration.text,
        fare: rideData.fare,
        status: rideData.status,
        createdAt: rideData.createdAt,
        updatedAt: rideData.updatedAt,
        driverId: rideData.driverId || null,
      });
    });

    return rides;
  } catch (error) {
    throw new Error(`Failed to fetch ride history: ${error.message}`);
  }
};

module.exports = {
  createUser,
  findUserByUID,
  updateUserVerification,
  updateUserProfile,
  getUserRideHistory,
};
