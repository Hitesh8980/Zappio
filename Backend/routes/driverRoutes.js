const express = require('express');
const router = express.Router();
const { otpRateLimit } = require('../middleware/rateLimit');
const { registerDriver, verifyDriver, resendOTP, loginDriver } = require('../controllers/driverController');

router.post('/register', registerDriver);
router.post('/verify', verifyDriver);
router.post('/resend-otp',otpRateLimit, resendOTP);
router.post('/login', loginDriver);

module.exports = router;