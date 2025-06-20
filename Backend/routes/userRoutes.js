const express = require('express');
const router = express.Router();
const { registerUser, verifyUser, resendOTP, loginUser } = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth');
const { getUserRideHistory } = require('../models/userModel');

router.get('/', (req, res) => res.status(200).json({ message: 'User routes' }));
router.post('/register', registerUser);
router.post('/verify', verifyUser);
router.post('/resend-otp', resendOTP);
router.post('/login', loginUser);
router.get('/profile', verifyToken, (req, res) => {
  res.status(200).json({ message: 'User profile accessed', entity: req.entity });
});
router.get('/ride-history', verifyToken, async (req, res) => {
  try {
    const userId = req.entity.uid;
    const { status } = req.query; // Optional status filter (e.g., completed, canceled)
    const rides = await getUserRideHistory(userId, status);
    res.status(200).json({ success: true, rides });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
// Temporary testing endpoint
// router.post('/test-otp', async (req, res) => {
//   try {
//     const { mobileNumber } = req.body;
//     if (!mobileNumber) {
//       return res.status(400).json({ message: 'Mobile number is required' });
//     }
//     res.status(200).json({ message: 'OTP triggered, check phone or use test OTP (e.g., 123456 for test numbers)' });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// });

module.exports = router;