const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.completeRide = functions.https.onCall(async (data, context) => {
  const { rideId, driverId } = data;
  if (!context.auth || context.auth.uid !== driverId) {
    throw new functions.https.HttpsError('unauthenticated', 'Not authorized');
  }

  return db.runTransaction(async (transaction) => {
    const rideRef = db.collection('rides').doc(rideId);
    const driverRef = db.collection('drivers').doc(driverId);

    const ride = (await transaction.get(rideRef)).data();
    if (!ride || ride.driverId !== driverId || ride.status !== 'ongoing') {
      throw new functions.https.HttpsError('failed-precondition', 'Invalid ride or driver');
    }

    transaction.update(rideRef, {
      status: 'completed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(driverRef, {
      status: 'available',
      currentRideId: null,
    });

    const user = (await db.collection('users').doc(ride.userId).get()).data();
    if (user?.fcmToken) {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: {
          title: 'Ride Completed',
          body: 'Your ride has been completed. Please rate your driver!',
        },
        data: { rideId },
      });
    }

    return { success: true };
  });
});