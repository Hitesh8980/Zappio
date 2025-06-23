// middleware/auth.js
const { auth, db } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
  console.log('🔐 verifyToken middleware called for:', req.originalUrl);

  try {
    const authHeader = req.headers.authorization || '';
const token = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

    if (!token) {
      console.warn('⚠️ No token provided');
      return res.status(401).json({ message: 'No token provided' });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Check Firestore for user or driver by phone number
    const phone = decodedToken.phone_number;

    const userSnapshot = await db.collection('users')
      .where('mobileNumber', '==', phone)
      .get();

    const driverSnapshot = await db.collection('drivers')
      .where('mobileNumber', '==', phone)
      .get();

    if (userSnapshot.empty && driverSnapshot.empty) {
      return res.status(404).json({ message: 'User or driver not found' });
    }

    let entity = null;
    if (!userSnapshot.empty) {
      userSnapshot.forEach(doc => {
        entity = { id: doc.id, ...doc.data(), type: 'user' };
      });
    } else if (!driverSnapshot.empty) {
      driverSnapshot.forEach(doc => {
        entity = { id: doc.id, ...doc.data(), type: 'driver' };
      });
    }

    if (!entity.verified) {
      return res.status(403).json({ message: 'Account not verified' });
    }

    req.entity = { uid, ...entity };
    next();
  } catch (error) {
    console.error('❌ verifyToken error:', error.message);
    res.status(401).json({ message: 'Invalid or expired token', error: error.message });
  }
};

module.exports = { verifyToken };
