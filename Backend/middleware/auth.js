const { auth, db } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Check if user or driver exists and is verified
    const userSnapshot = await db.collection('users')
      .where('mobileNumber', '==', decodedToken.phone_number)
      .get();
    const driverSnapshot = await db.collection('drivers')
      .where('mobileNumber', '==', decodedToken.phone_number)
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
    res.status(401).json({ message: 'Invalid or expired token', error: error.message });
  }
};

module.exports = { verifyToken };