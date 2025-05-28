// src/routes/locationRoutes.js
const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const auth = require('../middleware/auth');

// Log to debug imports
console.log('auth:', typeof auth);
console.log('auth.verifyToken:', typeof auth.verifyToken);
console.log('locationController:', typeof locationController);
console.log('locationController.getCoordinates:', typeof locationController.getCoordinates);

router.post('/geocode',  locationController.getCoordinates);
router.post('/current',  locationController.getCurrentLocation);

module.exports = router;