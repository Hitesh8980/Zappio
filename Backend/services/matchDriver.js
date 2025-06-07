const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GeoFirestore } = require('geofirestore');
const { getRoute } = require('../services/routingServices');
const { calculateDistance } = require('../services/mapServices');

admin.initializeApp();
const db = admin.firestore();
const geofirestore = new GeoFirestore(db);

exports.matchDriver = functions.firestore
  .document('rideRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();
    const { rideId, searchRadius = 5, expiresAt } = request;

    const ride = (await db.collection('rides').doc(rideId).get()).data();
    if (!ride) {
      await snap.ref.update({ status: 'expired' });
      return;
    }

    const drivers = await geofirestore
      .collection('drivers')
      .near({
        center: ride.pickupLocation,
        radius: searchRadius,
      })
      .where('isActive', '==', true)
      .where('status', 'in', ['available', 'on_ride'])
      .where('vehicle.type', '==', ride.vehicleType)
      .limit(10)
      .get();

    const eligibleDrivers = [];
    for (const driverDoc of drivers.docs) {
      const driver = driverDoc.data();
      if (await isDriverEligible(driver, ride)) {
        eligibleDrivers.push({ id: driverDoc.id, ...driver });
      }
    }

    eligibleDrivers.sort((a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1));

    if (eligibleDrivers.length === 0) {
      if (searchRadius < 10) {
        await snap.ref.update({ searchRadius: searchRadius + 2 });
        return;
      }
      await snap.ref.update({ status: 'expired' });
      await sendNoDriverNotification(ride.userId);
      return;
    }

    const payload = {
      notification: {
        title: 'New Ride Request',
        body: `Pickup: ${ride.pickupLocation.latitude}, ${ride.pickupLocation.longitude}, Fare: ₹${ride.fare.toFixed(2)}`,
      },
      data: { rideId, requestId: context.params.requestId },
    };
    const tokens = eligibleDrivers.map(driver => driver.fcmToken).filter(token => token);
    if (tokens.length > 0) {
      await admin.messaging().sendMulticast({ tokens, ...payload });
    }

    setTimeout(async () => {
      const currentRequest = (await snap.ref.get()).data();
      if (currentRequest.status === 'pending' && searchRadius < 10) {
        await snap.ref.update({ searchRadius: searchRadius + 2 });
      } else if (currentRequest.status === 'pending') {
        await snap.ref.update({ status: 'expired' });
        await sendNoDriverNotification(ride.userId);
      }
    }, expiresAt.toMillis() - Date.now());
  });

async function isDriverEligible(driver, ride) {
  const isAvailable = driver.status === 'available' || (await isFinishingSoon(driver.currentRideId));
  const meetsPreferences = !driver.preferences || (
    (driver.preferences.minRiderRating || 0) <= ride.riderRating &&
    calculateDistance(
      { lat: driver.currentLocation.latitude, lng: driver.currentLocation.longitude },
      { lat: ride.dropLocation.latitude, lng: ride.dropLocation.longitude }
    ) <= (driver.preferences.maxDistance || 20)
  );
  return isAvailable && meetsPreferences;
}

async function isFinishingSoon(rideId) {
  if (!rideId) return false;
  const ride = (await db.collection('rides').doc(rideId).get()).data();
  if (!ride || !ride.etaCompletion) return false;
  return ride.etaCompletion.toMillis() - Date.now() <= 2 * 60 * 1000;
}

async function sendNoDriverNotification(userId) {
  const user = (await db.collection('users').doc(userId).get()).data();
  if (user?.fcmToken) {
    await admin.messaging().send({
      token: user.fcmToken,
      notification: {
        title: 'No Drivers Available',
        body: 'Sorry, no drivers were found for your ride. Please try again later.',
      },
    });
  }
}