// src/routes/rideRoutes.js
const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const auth = require('../middleware/auth');
const rideValidators = require('../utils/rideValidator');

// Log to debug imports
console.log('auth:', typeof auth);
console.log('auth.verifyToken:', typeof auth.verifyToken);
console.log('rideValidators:', typeof rideValidators);
console.log('rideValidators.validateCreateRide:', typeof rideValidators.validateCreateRide);
console.log('rideController:', typeof rideController);
console.log('rideController.createRide:', typeof rideController.createRide);

router.post('/',  rideValidators.validateCreateRide, rideController.createRide);
router.get('/:rideId',  rideController.getRide);

module.exports = router;