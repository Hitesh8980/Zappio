const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const rideRequestController = require('../controllers/rideAcceptController');
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');
const rideValidators = require('../utils/rideValidator');

// Routes
router.get('/:rideId', rideController.getRide); // GET /api/rides/:rideId
router.post('/', rideValidators.validateCreateRide, rideController.createRide); // POST /api/rides
router.post('/notify-drivers', notificationController.notifyDrivers); // POST /api/rides/notify-drivers (no auth for testing)
router.post('/accept', rideRequestController.acceptRide); // POST /api/rides/accept
router.post('/arrived', rideController.driverArrived);
router.post('/start', rideController.startRide); // POST /api/rides/start
router.post('/end', rideController.endRide); // POST /api/rides/end



module.exports = router;