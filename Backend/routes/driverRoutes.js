const express = require('express');
const router = express.Router();
const {
  registerDriver,
  verifyDriver,
  updateDriverDocuments,
  loginDriver,
  updateProfile,
  updateLocation,
  updateStatus,
  getNearbyDrivers,
} = require('../controllers/driverController');

// Routes
router.post('/register', registerDriver);                  // Register driver (name, mobileNumber)
router.post('/verify', verifyDriver);                     // Verify driver using Firebase Auth idToken
router.put('/:driverId/documents', updateDriverDocuments); // Update Aadhaar, bank details, etc.
router.post('/login', loginDriver);                       // Login flow (Firebase Auth)
router.put('/:driverId/update-profile', updateProfile);   // Update other profile details
router.post('/:driverId/location', updateLocation);       // Update driver location
router.put('/:driverId/status', updateStatus);           // Update driver status
router.get('/nearby', getNearbyDrivers);                  // Get nearby drivers

module.exports = router;