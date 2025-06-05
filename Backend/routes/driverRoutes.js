const express = require('express');
const router = express.Router();

const {
  registerDriver,
  verifyDriver,
  verifyDriverOTP,
  resendOTP,
  loginDriver,
  updateDriverDetails,updateLocation,getNearbyDrivers
} = require('../controllers/driverController');

const { otpRateLimit } = require('../middleware/rateLimit');

// Routes
router.post('/register', registerDriver);
router.post('/verify', verifyDriver);                    // alternate: direct verify using mobileNumber
router.post('/verify-otp', verifyDriverOTP);             // verify using OTP
router.post('/resend-otp', otpRateLimit, resendOTP);     // resend OTP with rate limit
router.post('/login', loginDriver);                      // login flow (OTP-based)
router.put('/:driverId/update-profile', updateDriverDetails); // update Aadhaar, PAN, vehicle, etc.
router.post('/:driverId/location', updateLocation);
router.get('/nearby', getNearbyDrivers);
module.exports = router;
