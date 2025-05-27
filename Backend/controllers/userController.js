const { createUser, findUserByMobile, updateUserVerification } = require('../models/userModel');
const { sendOTP, verifyOTP } = require('../services/otpServices');

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
    const otpResponse = await sendOTP(mobileNumber);
    res.status(200).json({ message: 'User created, OTP sent', userId: user.id, ...otpResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyUser = async (req, res) => {
  try {
    const { userId, mobileNumber, otp } = req.body;
    if (!userId || !mobileNumber || !otp) {
      return res.status(400).json({ message: 'User ID, mobile number, and OTP are required' });
    }
    const isValid = await verifyOTP(mobileNumber, otp);
    if (isValid) {
      const updatedUser = await updateUserVerification(userId, true);
      res.status(200).json({ message: 'User verified successfully', user: updatedUser });
    }
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
    const otpResponse = await sendOTP(mobileNumber);
    res.status(200).json(otpResponse);
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
    const otpResponse = await sendOTP(mobileNumber);
    const token = await createCustomToken(mobileNumber); 
    res.status(200).json({ message: 'OTP sent for login', userId: user.id, token, ...otpResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  verifyUser,
  resendOTP,
  loginUser
};