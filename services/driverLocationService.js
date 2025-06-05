const admin = require('firebase-admin');
const { geocodeAddress } = require('./geoCodingServices');
const { calculateDistance } = require('./mapServices');

const db = admin.firestore();
const DRIVER_COLLECTION = 'drivers';

// Update driver's current location
const updateDriverLocation = async (driverId, locationData) => {
  try {
    // If location is an address string, geocode it first
    let coordinates;
    if (typeof locationData === 'string') {
      coordinates = await geocodeAddress(locationData);
    } else {
      coordinates = locationData;
    }

    const driverRef = db.collection(DRIVER_COLLECTION).doc(driverId);
    await driverRef.update({
      currentLocation: new admin.firestore.GeoPoint(coordinates.lat, coordinates.lng),
      lastLocationUpdate: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      status: 'available'
    });
    
    return { success: true, location: coordinates };
  } catch (error) {
    console.error('Error updating driver location:', error);
    throw new Error('Failed to update driver location');
  }
};

// Find nearby drivers within radius (in km)
const findNearbyDrivers = async (centerPoint, radiusKm, vehicleType = null) => {
  try {
    // Since Firestore doesn't support native geo-queries, we'll:
    // 1. Get all active drivers
    // 2. Filter them client-side (for small datasets)
    // For production, consider geohashing or Redis Geo
    
    let query = db.collection(DRIVER_COLLECTION)
      .where('isActive', '==', true)
      .where('status', '==', 'available');

    if (vehicleType) {
      query = query.where('vehicle.type', '==', vehicleType);
    }

    const snapshot = await query.get();
    if (snapshot.empty) return [];

    const nearbyDrivers = [];
    const now = new Date();
    
    snapshot.forEach(doc => {
      const driver = doc.data();
      // Skip if no recent location update (> 2 minutes)
      if (driver.lastLocationUpdate && 
          (now - driver.lastLocationUpdate.toDate()) > 120000) {
        return;
      }

      if (driver.currentLocation) {
        const distance = calculateDistance(
          { lat: centerPoint.lat, lng: centerPoint.lng },
          { lat: driver.currentLocation.latitude, lng: driver.currentLocation.longitude }
        );
        
        if (distance <= radiusKm) {
          nearbyDrivers.push({
            id: doc.id,
            distance,
            ...driver
          });
        }
      }
    });

    // Sort by distance (nearest first)
    return nearbyDrivers.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.error('Error finding nearby drivers:', error);
    throw new Error('Failed to find nearby drivers');
  }
};

module.exports = {
  updateDriverLocation,
  findNearbyDrivers
};