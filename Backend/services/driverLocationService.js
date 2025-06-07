const admin = require('firebase-admin');
const { GeoFirestore } = require('geofirestore');
const { geocodeAddress } = require('./geoCodingServices');

const db = admin.firestore();
const geofirestore = new GeoFirestore(db);
const DRIVER_COLLECTION = 'drivers';

const updateDriverLocation = async (driverId, locationData, fcmToken = null, preferences = null) => {
  try {
    let coordinates;
    if (typeof locationData === 'string') {
      coordinates = await geocodeAddress(locationData);
    } else {
      coordinates = locationData;
    }

    const driverRef = db.collection(DRIVER_COLLECTION).doc(driverId);
    const updateData = {
      currentLocation: new admin.firestore.GeoPoint(coordinates.lat, coordinates.lng),
      lastLocationUpdate: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
    };
    if (fcmToken) updateData.fcmToken = fcmToken;
    if (preferences) updateData.preferences = preferences; // e.g., { minRiderRating: 4.0, maxDistance: 20 }

    const driver = (await driverRef.get()).data();
    if (!driver?.currentRideId && !updateData.status) updateData.status = 'available';

    await driverRef.update(updateData);
    return { success: true, location: coordinates };
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw new Error('Failed to update driver location');
  }
};

const findNearbyDrivers = async (centerPoint, radiusKm, vehicleType = null) => {
  try {
    let query = geofirestore
      .collection(DRIVER_COLLECTION)
      .near({
        center: new admin.firestore.GeoPoint(centerPoint.lat, centerPoint.lng),
        radius: parseFloat(radiusKm),
      })
      .where('isActive', '==', true)
      .where('status', 'in', ['available', 'on_ride']);

    if (vehicleType && vehicleType !== 'any') {
      query = query.where('vehicle.type', '==', vehicleType);
    }

    const snapshot = await query.get();
    if (snapshot.empty) return [];

    const nearbyDrivers = [];
    const now = new Date();

    snapshot.forEach(doc => {
      const driver = doc.data();
      if (driver.lastLocationUpdate && (now - driver.lastLocationUpdate.toDate()) > 120000) {
        return;
      }
      nearbyDrivers.push({
        id: doc.id,
        distance: calculateDistance(centerPoint, {
          lat: driver.currentLocation.latitude,
          lng: driver.currentLocation.longitude,
        }),
        ...driver,
      });
    });

    return nearbyDrivers.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error('Error finding nearby drivers:', error);
    throw new Error('Failed to find nearby drivers');
  }
};

const calculateDistance = (point1, point2) => {
  const R = 6371;
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lng - point1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

module.exports = { updateDriverLocation, findNearbyDrivers };