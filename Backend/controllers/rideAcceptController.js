const { getRideRequest, updateRideRequest } = require('../models/rideRequestModel');
const { update } = require('../models/rideModel');
const { updateDriverStatus } = require('../models/driverModel');
const admin = require('firebase-admin');

const { db } = require('../config/firebase');
const { sendNotification } = require('../services/fcmServices');

const acceptRide = async (req, res) => {
  try {
    const { requestId, driverId } = req.body;
    // if (!req.user || req.user.uid !== driverId) {
    //   return res.status(403).json({ success: false, error: 'Unauthorized' });
    // }

    await db.runTransaction(async (transaction) => {
      const requestRef = db.collection('rideRequests').doc(requestId);
      const requestDoc = await transaction.get(requestRef);
      if (!requestDoc.exists || requestDoc.data().status !== 'pending') {
        throw new Error('Request already assigned or expired');
      }

      const rideRef = db.collection('rides').doc(requestDoc.data().rideId);
      const driverRef = db.collection('drivers').doc(driverId);
      const rideDoc = await transaction.get(rideRef);
      if (!rideDoc.exists) throw new Error('Ride not found');

      transaction.update(requestRef, { status: 'assigned', driverId });
      transaction.update(rideRef, {
        driverId,
        status: 'assigned',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.update(driverRef, {
        status: 'on_ride',
        currentRideId: requestDoc.data().rideId,
      });

      // Alternative approach: Query only on isActive first, then filter in code
      const driversSnapshot = await db.collection('drivers')
        .where('isActive', '==', true)
        .get();
      
      // Filter out drivers without fcmToken and exclude current driver
      const tokens = driversSnapshot.docs
        .filter(doc => 
          doc.id !== driverId && 
          doc.data().fcmToken && 
          doc.data().fcmToken !== null && 
          doc.data().fcmToken.trim() !== ''
        )
        .map(doc => doc.data().fcmToken);

      if (tokens.length > 0) {
        await sendNotification(tokens, {
          title: 'Ride Taken',
          body: 'This ride has been assigned to another driver.',
        }, { requestId });
      }

      // Notify rider
      const userDoc = await db.collection('users').doc(rideDoc.data().userId).get();
      if (userDoc.exists && userDoc.data().fcmToken) {
        await sendNotification([userDoc.data().fcmToken], {
          title: 'Driver Assigned',
          body: 'A driver has been assigned to your ride!',
        }, { rideId: requestDoc.data().rideId, driverId });
      }
    });

    res.json({ success: true, rideId: requestId });
  } catch (error) {
    console.error('Error accepting ride:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { acceptRide };