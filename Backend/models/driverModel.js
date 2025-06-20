const admin = require('firebase-admin');
const { GeoFirestore } = require('geofirestore');
const { db } = require('../config/firebase');
const geofirestore = new GeoFirestore(db);

const createDriver = async (driverData) => {
  const driverRef = db.collection('drivers').doc();
  const driver = {
    ...driverData,
    isActive: true,
    verified: false,
    status: 'offline',
    documentStatus: 'pending', // pending, partial, submitted
    kycStatus: 'pending', // pending, under_review, approved, rejected
    createdAt: new Date(),
    updatedAt: new Date(),
    canAcceptRides: false, // Only true when KYC is approved
    gstPending: 0,
    wallet: 0,
    gstPaidViaQR: 0
  };
  await driverRef.set(driver);
  return { id: driverRef.id, ...driver };
};

const findDriverByMobile = async (mobileNumber) => {
  const snapshot = await db.collection('drivers')
    .where('mobileNumber', '==', mobileNumber)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};

const updateDriverVerification = async (driverId, data) => {
  const driverRef = db.collection('drivers').doc(driverId);
  await driverRef.update({
    verified: true,
    firebaseUid: data.firebaseUid,
    updatedAt: new Date()
  });
};

const updateDriverProfile = async (driverId, updates) => {
  const driverRef = db.collection('drivers').doc(driverId);
  await driverRef.update({ ...updates, updatedAt: new Date() });
  const updatedDoc = await driverRef.get();
  return { id: driverId, ...updatedDoc.data() };
};

const updateDriverStatus = async (driverId, status) => {
  const driverRef = db.collection('drivers').doc(driverId);
  await driverRef.update({ status, updatedAt: new Date() });
  const updatedDoc = await driverRef.get();
  return { id: driverId, ...updatedDoc.data() };
};

const updateDriverLocation = async (driverId, location, fcmToken, preferences) => {
  const driverRef = geofirestore.collection('drivers').doc(driverId);
  const geoPoint = new admin.firestore.GeoPoint(location.lat, location.lng);
  const updates = {
    coordinates: geoPoint,
    currentLocation: geoPoint,
    g: {
      geopoint: geoPoint,
      geohash: require('geofire-common').geohashForLocation([location.lat, location.lng])
    },
    locationUpdatedAt: new Date(),
    updatedAt: new Date()
  };
  if (fcmToken) updates.fcmToken = fcmToken;
  if (preferences) updates.preferences = preferences;

  await driverRef.set(updates, { merge: true });
  const updatedDoc = await driverRef.get();
  return { id: driverId, ...updatedDoc.data() };
};

const updateDriverAfterRideEnd = async (driverId, paymentMode, fare) => {
  const driverRef = db.collection('drivers').doc(driverId);
  const gstAmount = parseFloat((fare * 0.18).toFixed(2));

  const updateData = {
    updatedAt: new Date()
  };

  if (paymentMode === 'qr') {
    updateData.wallet = admin.firestore.FieldValue.increment(fare - gstAmount);
    updateData.gstPaidViaQR = admin.firestore.FieldValue.increment(gstAmount);
  } else if (paymentMode === 'cash') {
    updateData.gstPending = gstAmount;
    updateData.canAcceptRides = false;
  }

  await driverRef.set(updateData, { merge: true });
};

const clearGstPending = async (driverId) => {
  const driverRef = db.collection('drivers').doc(driverId);
  await driverRef.update({
    gstPending: 0,
    canAcceptRides: true,
    updatedAt: new Date()
  });
};

// New function to get driver's current status for conditional rendering
const getDriverCurrentStatus = async (driverId) => {
  const driverDoc = await db.collection('drivers').doc(driverId).get();
  if (!driverDoc.exists) {
    throw new Error('Driver not found');
  }
  
  const data = driverDoc.data();
  return {
    id: driverId,
    verified: data.verified || false,
    documentStatus: data.documentStatus || 'pending',
    kycStatus: data.kycStatus || 'pending',
    canAcceptRides: data.canAcceptRides || false,
    ...data
  };
};

module.exports = {
  createDriver,
  findDriverByMobile,
  updateDriverVerification,
  updateDriverProfile,
  updateDriverStatus,
  updateDriverLocation,
  updateDriverAfterRideEnd,
  clearGstPending,
  getDriverCurrentStatus
};