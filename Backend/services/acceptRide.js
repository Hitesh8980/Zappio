const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.acceptRide = functions.https.onCall(async (data, context) => {
  const { requestId, driverId } = data;
  if (!context.auth || context.auth.uid !== driverId) {
    throw new functions.https.HttpsError('unauthenticated', 'Not authorized');
  }

  return admin.firestore().runTransaction(async (transaction) => {
    const requestRef = db.collection('rideRequests').doc(requestId);
    const request = (await transaction.get(requestRef)).data();
    if (!request || request.status !== 'pending') {
      throw new functions.https.HttpsError('failed-precondition', 'Request already assigned or expired');
    }

    const rideRef = db.collection('rides').doc(request.rideId);
    const driverRef = db.collection('drivers').doc(driverId);

    transaction.update(requestRef, { status: 'assigned', driverId });
    transaction.update(rideRef, {
      driverId,
      status: 'assigned',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(driverRef, { status: 'on_ride', currentRideId: request.rideId });

    const payload = {
      notification: { title: 'Ride Taken', body: 'This ride has been assigned to another driver.' },
      data: { requestId },
    };
    const drivers = (await db.collection('drivers').where('isActive', '==', true).get()).docs;
    const tokens = drivers.map(doc => doc.data().fcmToken).filter(token => token && doc.id !== driverId);
    if (tokens.length > 0) {
      await admin.messaging().sendMulticast({ tokens, ...payload });
    }

    const ride = (await rideRef.get()).data();
    const user = (await db.collection('users').doc(ride.userId).get()).data();
    if (user?.fcmToken) {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: {
          title: 'Driver Assigned',
          body: 'A driver has been assigned to your ride!',
        },
        data: { rideId: request.rideId, driverId },
      });
    }

    return { success: true, rideId: request.rideId };
  });
});