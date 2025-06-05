const { createDriver, findDriverByMobile, updateDriverVerification } = require('../models/driverModel');
const { sendOTP, verifyOTP } = require('../services/otpServices');
const {updateDriverLocation}=require('../services/driverLocationService')

const registerDriver = async (req, res) => {
  try {
    const { name, mobileNumber } = req.body;
    if (!name || !mobileNumber) {
      return res.status(400).json({ message: 'Name and mobile number are required' });
    }

    let driver = await findDriverByMobile(mobileNumber);

    if (driver && driver.verified) {
      return res.status(400).json({ message: 'Driver already registered and verified' });
    }

    if (!driver) {
      driver = await createDriver({ name, mobileNumber });
    }

    const otpResponse = await sendOTP(mobileNumber);
    res.status(200).json({ message: 'OTP sent to driver', driverId: driver.id, ...otpResponse });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const verifyDriver = async (req, res) => {
  try {
    const { driverId, idToken } = req.body;
    if (!driverId || !idToken) {
      return res.status(400).json({ message: 'Driver ID and ID token are required' });
    }
    const decodedToken = await verifyPhoneAuthToken(idToken);
    const driver = await findDriverByMobile(decodedToken.phone_number);
    if (!driver || driver.id !== driverId) {
      return res.status(400).json({ message: 'Driver not found or mismatch' });
    }
    const updatedDriver = await updateDriverVerification(driverId, true);
    const customToken = await auth.createCustomToken(decodedToken.uid);
    res.status(200).json({ message: 'Driver verified successfully', driver: updatedDriver, token: customToken });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
const verifyDriverOTP = async (req, res) => {
  try {
    const { driverId, mobileNumber, otp } = req.body;
    if (!driverId || !mobileNumber || !otp) {
      return res.status(400).json({ message: 'Driver ID, mobile number and OTP are required' });
    }
    const isValidOtp = await verifyOTP(mobileNumber, otp);
    if (!isValidOtp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    const updatedDriver = await updateDriverVerification(driverId, true);
    res.status(200).json({ message: 'Driver verified successfully', driver: updatedDriver });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
const updateDriverDetails = async (req, res) => {
  try {
    const { driverId } = req.params;
    const updates = req.body;

    const updatedDriver = await updateDriverProfile(driverId, updates);

    res.status(200).json({
      message: 'Driver profile updated successfully',
      driver: updatedDriver
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const updateLocation = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { location } = req.body; // Can be {lat, lng} or address string
    
    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    const result = await updateDriverLocation(driverId, location);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/drivers/nearby?lat=...&lng=...&radius=...
const getNearbyDrivers = async (req, res) => {
  try {
    const { lat, lng, radius = 3, vehicleType } = req.query;
    const center = { lat: parseFloat(lat), lng: parseFloat(lng) };
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const drivers = await findNearbyDrivers(center, parseFloat(radius), vehicleType);
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


module.exports = {
  registerDriver,
  verifyDriver,
  resendOTP,
  loginDriver,verifyDriverOTP,updateDriverDetails,getNearbyDrivers,updateLocation
  
};