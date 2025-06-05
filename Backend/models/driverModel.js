const { db } = require('../config/firebase');

const DRIVER_COLLECTION = 'drivers';

const createDriver = async (driverData) => {
  try {
    const driver = {
      name: driverData.name,
      mobileNumber: driverData.mobileNumber,
      role: 'driver',
      verified: false,
      createdAt: new Date(),

      // Optional details
      licenseNumber: driverData.licenseNumber || null,
      vehicle: driverData.vehicle || { type: null, registration: null },
      
      documents: {
        aadhaarFrontUrl: null,
        aadhaarBackUrl: null,
        licenseFrontUrl: null,
        licenseBackUrl: null,
        panCardUrl: null
      },

      bankDetails: {
        accountHolderName: null,
        accountNumber: null,
        ifscCode: null,
        bankName: null
      }
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
const updateDriverProfile = async (req, res) => {
  try {
    const { driverId } = req.params;
    const updates = req.body;

    const driverRef = db.collection('drivers').doc(driverId);
    await driverRef.update(updates);

    const updated = await driverRef.get();
    res.status(200).json({ message: 'Driver profile updated', driver: { id: updated.id, ...updated.data() } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const updateDriverStatus = async (driverId, status) => {
  try {
    const validStatuses = ['available', 'on_ride', 'offline'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid driver status');
    }

    const driverRef = db.collection(DRIVER_COLLECTION).doc(driverId);
    await driverRef.update({ status });
    
    const updated = await driverRef.get();
    return { id: updated.id, ...updated.data() };
  } catch (error) {
    throw new Error(`Failed to update driver status: ${error.message}`);
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
  updateDriverProfile,getDriverLocation,updateDriverStatus
};