const admin = require('firebase-admin');
const { db } = require('../config/firebase');
const geofire = require('geofire-common');

const DRIVER_COLLECTION = 'drivers';

const createDriver = async (driverData) => {
  try {
    const driver = {
      name: driverData.name,
      mobileNumber: driverData.mobileNumber,
      role: 'driver',
      verified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      licenseNumber: null,
      vehicle: { type: null, registration: null },
      documents: {
        aadhaarFrontUrl: null,
        aadhaarBackUrl: null,
        licenseFrontUrl: null,
        licenseBackUrl: null,
        panCardUrl: null,
      },
      bankDetails: {
        accountHolderName: null,
        accountNumber: null,
        ifscCode: null,
        bankName: null,
      },
      currentLocation: null,
      isActive: false,
      status: 'offline',
      currentRideId: null,
      preferences: { minRiderRating: 0, maxDistance: 20 },
      fcmToken: null,
      lastLocationUpdate: null,
    };

    const driverRef = db.collection(DRIVER_COLLECTION).doc();
    await driverRef.set(driver);
    return { id: driverRef.id, ...driver };
  } catch (error) {
    throw new Error(`Failed to create driver: ${error.message}`);
  }
};

const updateDriverProfile = async (driverId, updates) => {
  try {
    const driverRef = db.collection(DRIVER_COLLECTION).doc(driverId);
    const allowedUpdates = [
      'name', 'licenseNumber', 'vehicle', 'documents', 'bankDetails',
      'preferences', 'fcmToken',
    ];
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        if (key === 'documents') {
          // Ensure partial document updates are merged correctly
          const validDocumentFields = [
            'aadhaarFrontUrl', 'aadhaarBackUrl', 'licenseFrontUrl',
            'licenseBackUrl', 'panCardUrl',
          ];
          const documentUpdates = Object.keys(updates.documents)
            .filter(docKey => validDocumentFields.includes(docKey))
            .reduce((docObj, docKey) => ({
              ...docObj,
              [docKey]: updates.documents[docKey] || null,
            }), {});
          return { ...obj, documents: documentUpdates };
        }
        if (key === 'bankDetails') {
          // Ensure partial bank details updates are merged correctly
          const validBankFields = [
            'accountHolderName', 'accountNumber', 'ifscCode', 'bankName',
          ];
          const bankUpdates = Object.keys(updates.bankDetails)
            .filter(bankKey => validBankFields.includes(bankKey))
            .reduce((bankObj, bankKey) => ({
              ...bankObj,
              [bankKey]: updates.bankDetails[bankKey] || null,
            }), {});
          return { ...obj, bankDetails: bankUpdates };
        }
        return { ...obj, [key]: updates[key] };
      }, {});

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }

    await driverRef.update(filteredUpdates);
    const updated = await driverRef.get();
    if (!updated.exists) throw new Error('Driver not found');
    return { id: updated.id, ...updated.data() };
  } catch (error) {
    throw new Error(`Failed to update driver profile: ${error.message}`);
  }
};

// Other model functions (unchanged)
const findDriverByMobile = async (mobileNumber) => {
  try {
    const snapshot = await db.collection(DRIVER_COLLECTION)
      .where('mobileNumber', '==', mobileNumber)
      .get();
    if (snapshot.empty) return null;
    let driver = null;
    snapshot.forEach(doc => {
      driver = { id: doc.id, ...doc.data() };
    });
    return driver;
  } catch (error) {
    throw new Error(`Failed to find driver: ${error.message}`);
  }
};

const updateDriverVerification = async (driverId, verified) => {
  try {
    const driverRef = db.collection(DRIVER_COLLECTION).doc(driverId);
    await driverRef.update({ verified });
    const updatedDoc = await driverRef.get();
    if (!updatedDoc.exists) throw new Error('Driver not found');
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    throw new Error(`Failed to update verification: ${error.message}`);
  }
};

const updateDriverStatus = async (driverId, status) => {
  try {
    const validStatuses = ['available', 'on_ride', 'offline'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid driver status');
    }

    const driverRef = db.collection(DRIVER_COLLECTION).doc(driverId);
    const updates = { 
      status,
      isActive: status !== 'offline',
      lastLocationUpdate: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (status !== 'on_ride') updates.currentRideId = null;

    await driverRef.update(updates);
    const updated = await driverRef.get();
    if (!updated.exists) throw new Error('Driver not found');
    return { id: updated.id, ...updated.data() };
  } catch (error) {
    throw new Error(`Failed to update driver status: ${error.message}`);
  }
};

const updateDriverLocation = async (driverId, location, fcmToken = null, preferences = null) => {
  try {
    if (!location || !location.lat || !location.lng) {
      throw new Error('Valid latitude and longitude are required');
    }

    const driverRef = db.collection(DRIVER_COLLECTION).doc(driverId);
    const geohash = geofire.geohashForLocation([location.lat, location.lng]);
    const updates = {
      currentLocation: new admin.firestore.GeoPoint(location.lat, location.lng),
      geohash,
      lastLocationUpdate: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
    };
    if (fcmToken) updates.fcmToken = fcmToken;
    if (preferences) updates.preferences = preferences;

    await driverRef.update(updates);
    const updated = await driverRef.get();
    if (!updated.exists) throw new Error('Driver not found');
    return { id: updated.id, ...updated.data() };
  } catch (error) {
    throw new Error(`Failed to update driver location: ${error.message}`);
  }
};

const getDriverLocation = async (driverId) => {
  try {
    const doc = await db.collection(DRIVER_COLLECTION).doc(driverId).get();
    if (!doc.exists) return null;
    
    const data = doc.data();
    return data.currentLocation 
      ? { 
          lat: data.currentLocation.latitude, 
          lng: data.currentLocation.longitude,
          lastUpdated: data.lastLocationUpdate?.toDate() 
        }
      : null;
  } catch (error) {
    throw new Error(`Failed to get driver location: ${error.message}`);
  }
};

module.exports = {
  createDriver,
  findDriverByMobile,
  updateDriverVerification,
  updateDriverProfile,
  updateDriverStatus,
  updateDriverLocation,
  getDriverLocation,
};