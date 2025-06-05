const { db } = require('../config/firebase');

const OTP_COLLECTION = 'otps';

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const saveOTP = async (mobileNumber, otp) => {
  try {
    const otpData = {
      mobileNumber,
      otp,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    };
    console.log('Saving OTP for:', mobileNumber, otpData);
    const otpRef = db.collection(OTP_COLLECTION).doc();
    await otpRef.set(otpData);
    return otpRef.id;
  } catch (error) {
    throw new Error(`Failed to save OTP: ${error.message}`);
  }
};

const findOTPByMobile = async (mobileNumber) => {
  try {
    console.log('Querying OTP for:', mobileNumber);
    const snapshot = await db.collection(OTP_COLLECTION)
      .where('mobileNumber', '==', mobileNumber)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    if (snapshot.empty) {
      console.log('No OTP found for:', mobileNumber);
      return null;
    }
    let otpData = null;
    snapshot.forEach(doc => {
      otpData = { id: doc.id, ...doc.data() };
    });
    console.log('Found OTP:', otpData);
    const now = new Date();
    const expiresAt = otpData.expiresAt.toDate();

    console.log('Current time:', now, 'Expires at:', expiresAt);
    if (now > expiresAt) {
      console.log('Deleting expired OTP:', otpData.id);
      await db.collection(OTP_COLLECTION).doc(otpData.id).delete();
      return null;
    }
    return otpData;
  } catch (error) {
    throw new Error(`Failed to find OTP: ${error.message}`);
  }
};

const canResendOTP = async (mobileNumber) => {
  const otpData = await findOTPByMobile(mobileNumber);
  if (!otpData) {
    console.log('No valid OTP, can resend for:', mobileNumber);
    return true;
  }
  const now = new Date();
  const createdAt = otpData.createdAt.toDate();

  const timeSinceCreation = (now - createdAt) / 1000;
  console.log('OTP for', mobileNumber, 'created at:', createdAt, 'Time since creation (s):', timeSinceCreation);
  const canResend = timeSinceCreation >= 30;
  console.log('Can resend OTP for', mobileNumber, '?:', canResend);
  return canResend;
};

const sendOTP = async (mobileNumber) => {
  try {
    const canResend = await canResendOTP(mobileNumber);
    if (!canResend) {
      throw new Error('Please wait 30 seconds before resending OTP');
    }
    const otp = generateOTP();
    await saveOTP(mobileNumber, otp);
    console.log(`Simulated OTP sent to ${mobileNumber}: ${otp}`);
    return { message: 'OTP sent successfully' };
  } catch (error) {
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
};

const verifyOTP = async (mobileNumber, otp) => {
  try {
    const otpData = await findOTPByMobile(mobileNumber);
    if (!otpData) throw new Error('No valid OTP found');
    if (otpData.otp !== otp) throw new Error('Invalid OTP');
    console.log('Verified OTP for:', mobileNumber);
    await db.collection(OTP_COLLECTION).doc(otpData.id).delete();
    return true;
  } catch (error) {
    throw new Error(`OTP verification failed: ${error.message}`);
  }
};

module.exports = {
  sendOTP,
  verifyOTP
};