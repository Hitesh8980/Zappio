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
    const { requestId } = req.body;
    console.log(`Notify drivers for requestId: ${requestId}`);
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
    const radiusInKm = request.searchRadius || 5;
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
        console.log(`Driver ${doc.id}: isActive=${data.isActive}, status=${data.status}, vehicleType=${data.vehicle?.type}, fcmToken=${!!data.fcmToken}, distance=${doc.distance}km`);
        if (data.fcmToken && isDriverEligible(data, ride)) {
          return { id: doc.id, ...data, distance: doc.distance };
        }
        return null;
      })
      .filter(driver => driver)
      .sort((a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1));

    console.log(`Found ${eligibleDrivers.length} eligible drivers within ${radiusInKm}km`);

    if (eligibleDrivers.length === 0) {
      if (radiusInKm < 10) {
        const newRadius = Math.min(radiusInKm + 2, 10);
        await updateRideRequest(requestId, { searchRadius: newRadius });
        console.log(`Expanding radius to ${newRadius}km`);
        await axios.post(`http://localhost:3000/api/rides/notify-drivers`, { requestId });
        return res.json({ success: true, message: `Radius expanded to ${newRadius}km` });
      }
      await updateRideRequest(requestId, { status: 'expired' });
      await notifyRiderNoDrivers(ride.userId);
      return res.json({ success: true, message: 'No drivers found, request expired' });
    }

    const tokens = eligibleDrivers.map(driver => driver.fcmToken).filter(token => token);
    const notification = {
      title: 'New Ride Request',
      body: `Pickup: ${ride.pickupLocation.latitude}, ${ride.pickupLocation.longitude}, Fare: ₹${ride.fare.toFixed(2)}`,
    };
    const data = { rideId: ride.id, requestId };

    console.log('Mock FCM notifications:', { tokens, notification, data });

    setTimeout(async () => {
      const currentRequest = await getRideRequest(requestId);
      if (currentRequest?.status === 'pending' && (!currentRequest.expiresAt || currentRequest.expiresAt.toDate() > new Date())) {
        if (currentRequest.searchRadius < 10) {
          const newRadius = Math.min(currentRequest.searchRadius + 2, 10);
          await updateRideRequest(requestId, { searchRadius: newRadius });
          console.log(`Timeout: Expanding radius to ${newRadius}km`);
          await axios.post('http://localhost:3000/api/rides/notify-drivers', { requestId });
        } else {
          await updateRideRequest(requestId, { status: 'expired' });
          await notifyRiderNoDrivers(ride.userId);
          console.log(`Request ${requestId} expired after 30s`);
        }
      }
    }, 30 * 1000);

    res.json({ success: true, message: `Notifications prepared for ${tokens.length} drivers` });
  } catch (error) {
    console.error('Error notifying drivers:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

function isDriverEligible(driver, ride) {
  const meetsPreferences = !driver.preferences || (
    (driver.preferences.minRiderRating || 0) <= (ride.riderRating || 4.0) &&
    geofire.distanceBetween(
      [driver.currentLocation.latitude, driver.currentLocation.longitude],
      [ride.dropLocation.latitude, ride.dropLocation.longitude]
    ) <= (driver.preferences.maxDistance || 20)
  );
  console.log(`Driver eligibility: minRiderRating=${driver.preferences?.minRiderRating || 0} <= ${ride.riderRating || 4.0}, maxDistance=${
    geofire.distanceBetween([driver.currentLocation.latitude, driver.currentLocation.longitude], [ride.dropLocation.latitude, ride.dropLocation.longitude])
  } <= ${driver.preferences?.maxDistance || 20}, eligible=${meetsPreferences}`);
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
  console.log('Mock FCM notification to rider:', { token: userDoc.data().fcmToken, notification });
}

module.exports = { notifyDrivers };