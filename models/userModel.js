const { db } = require('../config/firebase');

// Collection name for users in Firestore
const USER_COLLECTION = 'users';

// Function to create a new user in Firestore
const createUser = async (userData) => {
  try {
    const user = {
      name: userData.name,
      mobileNumber: userData.mobileNumber,
      role: userData.role || 'user', 
      createdAt: new Date(),
      verified: false 
    };

    const userRef = db.collection(USER_COLLECTION).doc();
    await userRef.set(user);
    return { id: userRef.id, ...user };
  } catch (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }
};

// Function to find a user by mobile number
const findUserByMobile = async (mobileNumber) => {
  try {
    const snapshot = await db.collection(USER_COLLECTION)
      .where('mobileNumber', '==', mobileNumber)
      .get();
    
    if (snapshot.empty) {
      return null;
    }

    let user = null;
    snapshot.forEach(doc => {
      user = { id: doc.id, ...doc.data() };
    });
    return user;
  } catch (error) {
    throw new Error(`Failed to find user: ${error.message}`);
  }
};

// Function to update user verification status
const updateUserVerification = async (userId, verified) => {
  try {
    const userRef = db.collection(USER_COLLECTION).doc(userId);
    await userRef.update({ verified });
    const updatedDoc = await userRef.get();
    if (!updatedDoc.exists) {
      throw new Error('User not found');
    }
    return { id: updatedDoc.id, ...updatedDoc.data() };
  } catch (error) {
    throw new Error(`Failed to update verification: ${error.message}`);
  }
};

module.exports = {
  createUser,
  findUserByMobile,
  updateUserVerification
};