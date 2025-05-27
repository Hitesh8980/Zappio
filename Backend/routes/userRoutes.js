const express = require('express');
const router = express.Router();
const { otpRateLimit } = require('../middleware/rateLimit');
const { registerUser, verifyUser, resendOTP, loginUser } = require('../controllers/userController');

router.post('/register', registerUser);
router.post('/verify', verifyUser);
router.post('/resend-otp', otpRateLimit, resendOTP);
router.post('/login', loginUser);

module.exports = router;