const { createDriver, findDriverByMobile, updateDriverVerification } = require('../models/driverModel');
const { sendOTP, verifyOTP } = require('../services/otpServices');

const registerDriver = async (req, res) => {
  try {
    const { name, mobileNumber, licenseNumber, vehicle } = req.body;
    if (!name || !mobileNumber) {
      return res.status(400).json({ message: 'Name and mobile number are required' });
    }
    let driver = await findDriverByMobile(mobileNumber);
    if (driver && driver.verified) {
      return res.status(400).json({ message: 'Driver already registered and verified' });
    }
    if (!driver) {
      driver = await createDriver({ name, mobileNumber, licenseNumber, vehicle });
    }
    const otpResponse = await sendOTP(mobileNumber);
    res.status(200).json({ message: 'Driver created, OTP sent', driverId: driver.id, ...otpResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyDriver = async (req, res) => {
  try {
    const { driverId, mobileNumber, otp } = req.body;
    if (!driverId || !mobileNumber || !otp) {
      return res.status(400).json({ message: 'Driver ID, mobile number, and OTP are required' });
    }
    const isValid = await verifyOTP(mobileNumber, otp);
    if (isValid) {
      const updatedDriver = await updateDriverVerification(driverId, true);
      res.status(200).json({ message: 'Driver verified successfully', driver: updatedDriver });
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

const loginDriver = async (req, res) => {
  try {
    const { mobileNumber } = req.body;
    if (!mobileNumber) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }
    const driver = await findDriverByMobile(mobileNumber);
    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }
    if (!driver.verified) {
      return res.status(400).json({ message: 'Driver not verified, please verify with OTP' });
    }
    const otpResponse = await sendOTP(mobileNumber);
    res.status(200).json({ message: 'OTP sent for login', driverId: driver.id, ...otpResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerDriver,
  verifyDriver,
  resendOTP,
  loginDriver
};