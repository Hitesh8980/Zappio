const { auth, db } = require('../config/firebase');

const verifyToken = async (req, res, next) => {
  // console.log('🔐 verifyToken middleware called for:', req.originalUrl);
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

    if (!token) {
      // console.warn('⚠️ No token provided');
      return res.status(401).json({ message: 'No token provided' });
    }

    // console.log('Received token (partial):', token.substring(0, 20) + '...');
    const decodedToken = await auth.verifyIdToken(token);
    // console.log('Decoded token:', {
    //   uid: decodedToken.uid,
    //   phone_number: decodedToken.phone_number,
    //   iss: decodedToken.iss,
    //   aud: decodedToken.aud,
    //   iat: new Date(decodedToken.iat * 1000).toISOString(),
    //   exp: new Date(decodedToken.exp * 1000).toISOString(),
    // });

    const uid = decodedToken.uid;
    const phone = decodedToken.phone_number;

    const userSnapshot = await db.collection('users')
      .where('mobileNumber', '==', phone)
      .get();
    console.log('User snapshot:', {
      empty: userSnapshot.empty,
      docs: userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    });

    const driverSnapshot = await db.collection('drivers')
      .where('mobileNumber', '==', phone)
      .get();
    console.log('Driver snapshot:', {
      empty: driverSnapshot.empty,
      docs: driverSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    });

    if (userSnapshot.empty && driverSnapshot.empty) {
      // console.warn('No user or driver found for phone:', phone);
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

    console.log('Entity:', entity);
    if (!entity.verified) {
      // console.warn('Account not verified for phone:', phone);
      return res.status(403).json({ message: 'Account not verified' });
    }

    req.entity = { uid, ...entity };
    next();
  } catch (error) {
    // console.error('❌ verifyToken error:', {
    //   code: error.code,
    //   message: error.message,
    //   stack: error.stack,
    // });
    return res.status(401).json({
      message: 'Invalid or expired token',
      error: error.message,
      code: error.code,
    });
  }
};

module.exports = { verifyToken };