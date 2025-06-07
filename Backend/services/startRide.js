const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getRoute } = require('../services/routingServices');

exports.startRide = functions.https.onCall(async (data, context) => {
  const { rideId, driverId } = data;
  if (!context.auth || context.auth.uid !== driverId) {
    throw new functions.https.HttpsError('unauthenticated', 'Not authorized');
  }

  const rideRef = db.collection('rides').doc(rideId);
  const ride = (await rideRef.get()).data();
  if (!ride || ride.driverId !== driverId || ride.status !== 'assigned') {
    throw new functions.https.HttpsError('failed-precondition', 'Invalid ride or driver');
  }

  const route = await getRoute(
    { lat: ride.pickupLocation.latitude, lng: ride.pickupLocation.longitude },
    { lat: ride.dropLocation.latitude, lng: ride.dropLocation.longitude }
  );
  const eta = new Date(Date.now() + route.duration.value * 1000);

  await rideRef.update({
    status: 'ongoing',
    etaCompletion: admin.firestore.Timestamp.fromDate(eta),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});