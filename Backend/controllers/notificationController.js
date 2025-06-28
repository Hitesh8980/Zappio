const { sendNotification } = require('../services/fcmServices');
const { getRideRequest, updateRideRequest } = require('../models/rideRequestModel');
const { get } = require('../models/rideModel');
const { db } = require('../config/firebase');
const { GeoFirestore } = require('geofirestore');
const admin = require('firebase-admin');
const geofire = require('geofire-common');
const axios = require('axios');

const geofirestore = new GeoFirestore(db);

const notifyDrivers = async (req, res) => {
  try {
    const { requestId, testMode = false, testRadius } = req.body;
    console.log(`Notify drivers for requestId: ${requestId}, testMode: ${testMode}, testRadius: ${testRadius}km`);

    if (!requestId) {
      return res.status(400).json({ success: false, error: 'Request ID required' });
    }

    const request = await getRideRequest(requestId);
    if (!request || request.status !== 'pending' || (request.expiresAt && request.expiresAt.toDate() < new Date())) {
      return res.status(400).json({ success: false, error: 'Invalid or expired request' });
    }

    const ride = await get(request.rideId);
    if (!ride) {
      await updateRideRequest(requestId, { status: 'expired' });
      return res.status(404).json({ success: false, error: 'Ride not found' });
    }

    const center = new admin.firestore.GeoPoint(ride.pickupLocation.latitude, ride.pickupLocation.longitude);
    // Use testRadius if testMode is true and testRadius is provided; otherwise, use default logic
    const radiusInKm = testMode && testRadius ? testRadius : (request.searchRadius || 5);
    const maxRadius = testMode ? 5000 : 10; // Allow up to 5000 km in test mode, 10 km otherwise

    const driversCollection = geofirestore.collection('drivers');
    let query = driversCollection.near({ center, radius: radiusInKm })
      .where('isActive', '==', true)
      .where('status', 'in', ['available', 'on_ride']);

    if (ride.vehicleType) {
      query = query.where('vehicle.type', '==', ride.vehicleType);
    }

    console.log(`Querying drivers: center=${center.latitude},${center.longitude}, radius=${radiusInKm}km, vehicleType=${ride.vehicleType}`);

    const snapshot = await query.get();
    const eligibleDrivers = snapshot.docs
      .map(doc => {
        const data = doc.data();
        if (data.fcmToken && isDriverEligible(data, ride)) {
          return { id: doc.id, ...data, distance: doc.distance };
        }
        return null;
      })
      .filter(driver => driver)
      .sort((a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1));

    console.log(`Found ${eligibleDrivers.length} eligible drivers within ${radiusInKm}km`);

    if (eligibleDrivers.length === 0) {
      if (radiusInKm < maxRadius) {
        const newRadius = Math.min(radiusInKm + 2, maxRadius);
        await updateRideRequest(requestId, { searchRadius: newRadius });
        console.log(`Expanding radius to ${newRadius}km`);
        await axios.post('https://zappio.onrender.com/api/rides/notify-drivers', { 
          requestId, 
          testMode, 
          testRadius: testMode ? testRadius : undefined 
        });
        return res.json({ success: true, message: `Radius expanded to ${newRadius}km` });
      }
      await updateRideRequest(requestId, { status: 'expired' });
      await notifyRiderNoDrivers(ride.userId);
      return res.json({ success: true, message: 'No drivers found, request expired' });
    }

    const tokens = eligibleDrivers.map(driver => driver.fcmToken).filter(token => token);

    const notification = {
      title: 'New Ride Request',
      body: `From: ${ride.pickupLocationName || 'Pickup'} → To: ${ride.dropLocationName || 'Drop'} | ${((ride.distance?.value || 0) / 1000).toFixed(1)} km, ₹${ride.fare.toFixed(2)}`,
    };

    const data = {
      rideId: ride.id,
      requestId,
      pickupLocation: ride.pickupLocationName || '',
      dropLocation: ride.dropLocationName || '',
      pickupCoords: ride.pickupLocation,
      dropCoords: ride.dropLocation,
      distance: ride.distance?.value || 0,
      duration: ride.duration?.value || 0,
      fare: ride.fare || 0
    };

    await sendNotification(tokens, notification, data);
    console.log(`Notifications sent to ${tokens.length} drivers`);

    setTimeout(async () => {
      const currentRequest = await getRideRequest(requestId);
      if (currentRequest?.status === 'pending' && (!currentRequest.expiresAt || currentRequest.expiresAt.toDate() > new Date())) {
        if (currentRequest.searchRadius < maxRadius) {
          const newRadius = Math.min(currentRequest.searchRadius + 2, maxRadius);
          await updateRideRequest(requestId, { searchRadius: newRadius });
          console.log(`Timeout: Expanding radius to ${newRadius}km`);
          await axios.post('https://zappio.onrender.com/api/rides/notify-drivers', { 
            requestId, 
            testMode, 
            testRadius: testMode ? testRadius : undefined 
          });
        } else {
          await updateRideRequest(requestId, { status: 'expired' });
          await notifyRiderNoDrivers(ride.userId);
          console.log(`Request ${requestId} expired after 30s`);
        }
      }
    }, 30 * 1000);

    res.json({ success: true, message: `Notifications sent to ${tokens.length} drivers` });
  } catch (error) {
    console.error('Error notifying drivers:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

function isDriverEligible(driver, ride) {
  const minRiderRating = driver.preferences?.minRiderRating || 0;
  const maxDistance = driver.preferences?.maxDistance || driver.preferences?.maxRadius || 20;
  const riderRating = ride.riderRating || 4.0;
  const distanceToDrop = geofire.distanceBetween(
    [driver.currentLocation.latitude, driver.currentLocation.longitude],
    [ride.dropLocation.latitude, ride.dropLocation.longitude]
  );
  console.log(`Driver ${driver.name}: minRiderRating=${minRiderRating}, riderRating=${riderRating}, distanceToDrop=${distanceToDrop}, maxDistance=${maxDistance}`);
  const meetsPreferences = !driver.preferences || (
    minRiderRating <= riderRating &&
    distanceToDrop <= maxDistance
  );
  return meetsPreferences;
}

async function notifyRiderNoDrivers(userId) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists || !userDoc.data().fcmToken) return;

  const notification = {
    title: 'No Drivers Found',
    body: 'Sorry, no drivers are available at the moment.',
  };
  await sendNotification([userDoc.data().fcmToken], notification);
}

module.exports = { notifyDrivers };