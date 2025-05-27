const { db } = require('../config/firebase');

const DRIVER_COLLECTION = 'drivers';

const createDriver = async (driverData) => {
  try {
    const driver = {
      name: driverData.name,
      mobileNumber: driverData.mobileNumber,
      role: driverData.role || 'driver',
      licenseNumber: driverData.licenseNumber || null,
      vehicle: driverData.vehicle || { type: null, registration: null },
      createdAt: new Date(),
      verified: false
    };
    const driverRef = db.collection(DRIVER_COLLECTION).doc();
    await driverRef.set(driver);
    return { id: driverRef.id, ...driver };
  } catch (error) {
    throw new Error(`Failed to create driver: ${error.message}`);
  }
};

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

module.exports = {
  createDriver,
  findDriverByMobile,
  updateDriverVerification
};