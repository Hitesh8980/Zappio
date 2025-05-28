const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const auth = require('../middleware/auth');
const bookingValidators = require('../utils/bookingValidators');

// Log to debug imports
console.log('auth:', typeof auth);
console.log('auth.verifyToken:', typeof auth.verifyToken);
console.log('bookingValidators.validateCreateBooking:', typeof bookingValidators.validateCreateBooking);
console.log('bookingController.createBooking:', typeof bookingController.createBooking);

router.post('/',  bookingValidators.validateCreateBooking, bookingController.createBooking);
router.get('/:bookingId',  bookingController.getBooking);

module.exports = router;