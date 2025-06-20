const { createDriver, findDriverByMobile, updateDriverVerification, updateDriverProfile, updateDriverStatus, updateDriverLocation, getDriverLocation } = require('../models/driverModel');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { GeoFirestore } = require('geofirestore');
const { db } = require('../config/firebase');
const geofirestore = new GeoFirestore(db);
const uploadToFirebase = require('../utils/uploadtoFirebase');
const { getStorage } = require('firebase-admin/storage');
const { bucket } = require('../config/firebase');

const registerDriver = async (req, res) => {
  try {
    const { name, mobileNumber } = req.body;
    if (!name || !mobileNumber) {
      return res.status(400).json({ success: false, error: 'Name and mobile number are required' });
    }

    let driver = await findDriverByMobile(mobileNumber);
    if (driver && driver.verified) {
      return res.status(400).json({ success: false, error: 'Driver already registered and verified' });
    }

    if (!driver) {
      driver = await createDriver({ name, mobileNumber });
    }

    // Firebase Authentication will handle OTP verification; client should initiate OTP flow
    res.json({ success: true, driverId: driver.id, message: 'Driver registered, please verify with OTP' });
  } catch (error) {
    console.error('Error registering driver:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const verifyDriver = async (req, res) => {
  try {
    const { driverId, idToken } = req.body;
    if (!driverId || !idToken) {
      return res.status(400).json({ success: false, error: 'Driver ID and ID token are required' });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const driver = await findDriverByMobile(decodedToken.phone_number);
    if (!driver || driver.id !== driverId) {
      return res.status(400).json({ success: false, error: 'Driver not found or mismatch' });
    }
    if (driver.verified) {
      return res.status(400).json({ success: false, error: 'Driver already verified' });
    }

    // Link Firebase Auth UID to Firestore document
    await db.collection('drivers').doc(driverId).update({ 
      verified: true,
      firebaseUid: decodedToken.uid,
    });

    const updatedDriver = await db.collection('drivers').doc(driverId).get();
    const customToken = await admin.auth().createCustomToken(decodedToken.uid);
    res.json({ 
      success: true, 
      driver: { id: updatedDriver.id, ...updatedDriver.data() }, 
      token: customToken 
    });
  } catch (error) {
    console.error('Error verifying driver:', error);
    res.status(400).json({ success: false, error: error.message });
  }
};

const updateDriverDocuments = async (req, res) => {
  try {
    const { driverId } = req.params;

    if (!req.files) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const fileFields = [
      'aadhaarFront',
      'aadhaarBack',
      'licenseFront',
      'licenseBack',
      'panCard',
      'insurance',
      'rcFront',
      'rcBack'
    ];

    const uploadedUrls = {};

    for (const field of fileFields) {
      const file = req.files[field]?.[0];
      if (file) {
        const storagePath = `drivers/${driverId}/${field}_${Date.now()}_${file.originalname}`;
        const fileUpload = bucket.file(storagePath);

        await fileUpload.save(file.buffer, {
          metadata: { contentType: file.mimetype },
          public: true,
        });

        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        uploadedUrls[field] = publicUrl;
      }
    }

    // Get current driver document to check existing documents
    const currentDriverDoc = await db.collection('drivers').doc(driverId).get();
    const currentData = currentDriverDoc.data();
    const existingDocuments = currentData?.documents || {};
    
    // Merge with existing documents
    const allDocuments = { ...existingDocuments, ...uploadedUrls };
    
    // Check if all required documents are uploaded
    const requiredDocuments = ['aadhaarFront', 'aadhaarBack', 'licenseFront', 'licenseBack', 'panCard', 'insurance', 'rcFront', 'rcBack'];
    const uploadedDocumentKeys = Object.keys(allDocuments);
    const allDocumentsUploaded = requiredDocuments.every(doc => uploadedDocumentKeys.includes(doc));
    
    // Determine document status
    let documentStatus = 'pending'; // Default status
    if (uploadedDocumentKeys.length > 0 && !allDocumentsUploaded) {
      documentStatus = 'partial';
    } else if (allDocumentsUploaded) {
      documentStatus = 'submitted';
    }

    // Update driver document with new status
    await db.collection('drivers').doc(driverId).set({
      documents: allDocuments,
      documentStatus: documentStatus,
      updatedAt: new Date(),
    }, { merge: true });

    res.status(200).json({
      message: 'Documents uploaded successfully',
      documents: uploadedUrls,
      documentStatus: documentStatus,
      allDocumentsSubmitted: allDocumentsUploaded
    });

  } catch (error) {
    console.error('❌ Error uploading documents:', error);
    res.status(500).json({
      message: 'Something went wrong',
      error: error.message,
    });
  }
};

// New function to update KYC status (for admin approval)
const updateKycStatus = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { kycStatus, rejectionReason } = req.body;

    if (!['approved', 'rejected', 'under_review'].includes(kycStatus)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid KYC status. Must be approved, rejected, or under_review' 
      });
    }

    const updateData = {
      kycStatus: kycStatus,
      updatedAt: new Date(),
    };

    if (kycStatus === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    if (kycStatus === 'approved') {
      updateData.canAcceptRides = true;
      updateData.rejectionReason = null; // Clear any previous rejection reason
    }

    await db.collection('drivers').doc(driverId).update(updateData);

    const updatedDriver = await db.collection('drivers').doc(driverId).get();
    
    res.json({ 
      success: true, 
      driver: { id: updatedDriver.id, ...updatedDriver.data() },
      message: `KYC status updated to ${kycStatus}`
    });
  } catch (error) {
    console.error('Error updating KYC status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get driver status for conditional rendering
const getDriverStatus = async (req, res) => {
  try {
    const { driverId } = req.params;
    
    const driverDoc = await db.collection('drivers').doc(driverId).get();
    
    if (!driverDoc.exists) {
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }

    const driverData = driverDoc.data();
    
    const status = {
      verified: driverData.verified || false,
      documentStatus: driverData.documentStatus || 'pending',
      kycStatus: driverData.kycStatus || 'pending',
      canAcceptRides: driverData.canAcceptRides || false,
      documentsSubmitted: driverData.documentStatus === 'submitted',
      kycApproved: driverData.kycStatus === 'approved'
    };

    res.json({ success: true, status });
  } catch (error) {
    console.error('Error getting driver status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const loginDriver = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'ID token is required' });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const driver = await findDriverByMobile(decodedToken.phone_number);
    if (!driver) {
      return res.status(404).json({ success: false, error: 'Driver not found' });
    }
    if (!driver.verified) {
      return res.status(400).json({ success: false, error: 'Driver not verified' });
    }

    const customToken = await admin.auth().createCustomToken(decodedToken.uid);
    res.json({ success: true, driverId: driver.id, driver, token: customToken });
  } catch (error) {
    console.error('Error logging in driver:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { driverId } = req.params;
    const updates = req.body;
    // if (!req.user || req.user.uid !== driverId) {
    //   return res.status(403).json({ success: false, error: 'Unauthorized' });
    // }
    if (updates.fcmToken && typeof updates.fcmToken !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid fcmToken' });
    }

    const updatedDriver = await updateDriverProfile(driverId, updates);
    res.json({ success: true, driver: updatedDriver });
  } catch (error) {
    console.error('Error updating driver profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateLocation = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { location, fcmToken, preferences } = req.body;
    // if (!req.user || req.user.uid !== driverId) {
    //   return res.status(403).json({ success: false, error: 'Unauthorized' });
    // }
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return res.status(400).json({ success: false, error: 'Valid location (lat, lng) is required' });
    }
    if (fcmToken && typeof fcmToken !== 'string') {
      return res.status(400).json({ success: false, error: 'Invalid fcmToken' });
    }

    const driver = await updateDriverLocation(driverId, location, fcmToken, preferences);
    res.json({ success: true, driver });
  } catch (error) {
    console.error('Error updating driver location:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateStatus = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status } = req.body;
    // if (!req.user || req.user.uid !== driverId) {
    //   return res.status(403).json({ success: false, error: 'Unauthorized' });
    // }
    if (!['available', 'on_ride', 'offline'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const driver = await updateDriverStatus(driverId, status);
    res.json({ success: true, driver });
  } catch (error) {
    console.error('Error updating driver status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getNearbyDrivers = async (req, res) => {
  try {
    const { lat, lng, radius = 5, vehicleType } = req.query;
    const center = { lat: parseFloat(lat), lng: parseFloat(lng) };
    if (!center.lat || !center.lng) {
      return res.status(400).json({ success: false, error: 'Valid latitude and longitude are required' });
    }
    if (vehicleType && !['bike', 'auto', 'car'].includes(vehicleType)) {
      return res.status(400).json({ success: false, error: 'Invalid vehicle type' });
    }

    const driversCollection = geofirestore.collection('drivers');
    let query = driversCollection.near({
      center: new admin.firestore.GeoPoint(center.lat, center.lng),
      radius: parseFloat(radius),
    }).where('isActive', '==', true);

    if (vehicleType) {
      query = query.where('vehicle.type', '==', vehicleType);
    }

    const snapshot = await query.get();
    const drivers = snapshot.docs
      .map(doc => {
        const data = doc.data();
        const distance = doc.distance;
        if (data.status === 'available' || data.status === 'on_ride') {
          return { id: doc.id, ...data, distance };
        }
        return null;
      })
      .filter(driver => driver)
      .sort((a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1));

    res.json({ success: true, drivers });
  } catch (error) {
    console.error('Error getting nearby drivers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  registerDriver,
  verifyDriver,
  updateDriverDocuments,
  updateKycStatus,
  getDriverStatus,
  loginDriver,
  updateProfile,
  updateLocation,
  updateStatus,
  getNearbyDrivers,
};