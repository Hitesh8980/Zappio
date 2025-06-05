const { auth, db } = require('../config/firebase');

const createCustomToken = async (mobileNumber) => {
  try {
    // Check if user or driver exists
    const userSnapshot = await db.collection('users')
      .where('mobileNumber', '==', mobileNumber)
      .get();
    const driverSnapshot = await db.collection('drivers')
      .where('mobileNumber', '==', mobileNumber)
      .get();

    if (userSnapshot.empty && driverSnapshot.empty) {
      throw new Error('User or driver not found');
    }

    let entityId = null;
    if (!userSnapshot.empty) {
      userSnapshot.forEach(doc => {
        entityId = doc.id;
      });
    } else if (!driverSnapshot.empty) {
      driverSnapshot.forEach(doc => {
        entityId = doc.id;
      });
    }

    const customToken = await auth.createCustomToken(entityId);
    return customToken;
  } catch (error) {
    throw new Error(`Failed to create custom token: ${error.message}`);
  }
};

module.exports = {
  createCustomToken
};