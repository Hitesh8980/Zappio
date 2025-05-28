const { createUser, findUserByMobile, updateUserVerification } = require('../models/userModel');
const { verifyPhoneAuthToken } = require('../services/authServices');
const { auth } = require('../config/firebase');

const registerUser = async (req, res) => {
  try {
    const { name, mobileNumber } = req.body;
    if (!name || !mobileNumber) {
      return res.status(400).json({ message: 'Name and mobile number are required' });
    }
    let user = await findUserByMobile(mobileNumber);
    if (user && user.verified) {
      return res.status(400).json({ message: 'User already registered and verified' });
    }
    if (!user) {
      user = await createUser({ name, mobileNumber });
    }
    // Frontend triggers OTP via Firebase Client SDK
    res.status(200).json({ message: 'User created, initiate phone auth', userId: user.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyUser = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'ID token is required' });
    }

    // 1. Verify Firebase ID token
    const decodedToken = await verifyPhoneAuthToken(idToken);
    const phoneNumber = decodedToken.phone_number;

    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number not found in token' });
    }

    // 2. Find user in Firestore by phone number
    const user = await findUserByMobile(phoneNumber);
    if (!user) {
      return res.status(404).json({ message: 'User not found for this phone number' });
    }

    // 3. Update user as verified
    const updatedUser = await updateUserVerification(user.id, true);

    // 4. Create a custom token using Firebase UID
    const customToken = await auth.createCustomToken(decodedToken.uid);

    // 5. Respond
    res.status(200).json({
      message: 'User verified successfully',
      user: updatedUser,
      token: customToken
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};


const resendOTP = async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }
    // Frontend triggers OTP resend via Firebase Client SDK
    res.status(200).json({ message: 'Initiate phone auth resend' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }
    const user = await findUserByMobile(mobileNumber);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!user.verified) {
      return res.status(400).json({ message: 'User not verified, please verify with OTP' });
    }
    // Frontend triggers OTP via Firebase Client SDK
    res.status(200).json({ message: 'Initiate phone auth for login', userId: user.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerUser, verifyUser, resendOTP, loginUser };