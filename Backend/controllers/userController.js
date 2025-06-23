const {
  createUser,
  findUserByUID,
  updateUserVerification
} = require('../models/userModel');
const { auth, db  } = require('../config/firebase');
const admin = require('firebase-admin');

const registerUser = async (req, res) => {
  try {
    const { name, mobileNumber } = req.body;

    if (!name || !mobileNumber) {
      return res.status(400).json({ message: 'Name and mobile number are required' });
    }

    // Check if user already exists based on mobile number
    const userSnapshot = await db.collection('users')
      .where('mobileNumber', '==', mobileNumber)
      .limit(1)
      .get();

    if (!userSnapshot.empty) {
      const existingUser = userSnapshot.docs[0].data();
      if (existingUser.verified) {
        return res.status(400).json({ message: 'User already registered and verified' });
      }
    }

    // Create a new user entry
    const newUserRef = await db.collection('users').add({
      name,
      mobileNumber,
      verified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      message: 'User created, initiate phone auth',
      userId: newUserRef.id,
    });

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
