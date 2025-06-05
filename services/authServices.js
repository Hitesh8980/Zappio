const { auth } = require('../config/firebase');

const verifyPhoneAuthToken = async (idToken) => {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    if (!decodedToken.phone_number) {
      throw new Error('No phone number in token');
    }
    return decodedToken;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

module.exports = { verifyPhoneAuthToken };