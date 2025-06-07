const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getRoute } = require('../services/routingServices');

exports.updateDriverETA = functions.firestore
  .document('drivers/{driverId}')
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();
    if (
      newData.status !== 'on_ride' ||
      !newData.currentRideId ||
      newData.currentLocation === oldData.currentLocation
    ) {
      return;
    }

    const ride = (await db.collection('rides').doc(newData.currentRideId).get()).data();
    if (!ride || ride.status !== 'ongoing') return;

    const route = await getRoute(
      { lat: newData.currentLocation.latitude, lng: newData.currentLocation.longitude },
      { lat: ride.dropLocation.latitude, lng: ride.dropLocation.longitude }
    );
    if (route.duration) {
      const eta = new Date(Date.now() + route.duration.value * 1000);
      await db.collection('rides').doc(newData.currentRideId).update({
        etaCompletion: admin.firestore.Timestamp.fromDate(eta),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });