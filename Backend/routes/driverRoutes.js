const express = require('express');
const router = express.Router();
const multer = require('multer');
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

// Set up Multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Document upload fields
const documentFields = [
  { name: 'aadhaarFront', maxCount: 1 },
  { name: 'aadhaarBack', maxCount: 1 },
  { name: 'licenseFront', maxCount: 1 },
  { name: 'licenseBack', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'insurance', maxCount: 1 },
  { name: 'rcFront', maxCount: 1 },
  { name: 'rcBack', maxCount: 1 }   
];

// Routes
router.post('/register', registerDriver); // Register driver (name, mobileNumber)
router.post('/verify', verifyDriver); // Verify driver using Firebase Auth idToken
router.put('/:driverId/documents', upload.fields(documentFields), updateDriverDocuments); // Upload/update driver documents
router.post('/login', loginDriver); // Login flow (Firebase Auth)
router.put('/:driverId/update-profile', updateProfile); // Update profile details
router.post('/:driverId/location', updateLocation); // Update driver location
router.put('/:driverId/status', updateStatus); // Update driver status
router.get('/nearby', getNearbyDrivers); // Get nearby drivers

module.exports = router;
