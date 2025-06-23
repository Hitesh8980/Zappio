const {
  createUser,
  findUserByUID,
  updateUserVerification
} = require('../models/userModel');
const { auth } = require('../config/firebase');

const registerUser = async (req, res) => {
  try {
    const { uid, name, mobileNumber } = req.body;
    if (!uid || !name || !mobileNumber) {
      return res.status(400).json({ message: 'UID, name, and mobile number are required' });
    }

    let user = await findUserByUID(uid);
    if (user && user.verified) {
      return res.status(400).json({ message: 'User already registered and verified' });
    }

    if (!user) {
      user = await createUser({ uid, name, mobileNumber });
    }

    res.status(200).json({ message: 'User created, initiate phone auth', userId: user.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyUser = async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ message: 'UID is required' });
    }

    const user = await findUserByUID(uid);
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    const updatedUser = await updateUserVerification(uid, true);

    const customToken = await auth.createCustomToken(uid);

    res.status(200).json({
      message: 'User verified successfully',
      user: updatedUser,
      userId: uid,
      token: customToken,
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
    res.status(200).json({ message: 'Initiate phone auth resend' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).json({ message: 'UID is required' });
    }

    const user = await findUserByUID(uid);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.verified) {
      return res.status(400).json({ message: 'User not verified, please verify with OTP' });
    }

    res.status(200).json({ message: 'Initiate phone auth for login', userId: uid });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerUser, verifyUser, resendOTP, loginUser };
